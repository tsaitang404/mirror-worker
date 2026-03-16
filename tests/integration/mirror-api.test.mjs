import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASE_URL = 'http://127.0.0.1:8787';
const STARTUP_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_000;
const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = dirname(CURRENT_FILE);
const WORKER_FILE = resolve(CURRENT_DIR, '../../mirror-worker.js');

/** @type {import('node:child_process').ChildProcess | undefined} */
let workerProcess;

/**
 * Wait until the local worker responds.
 *
 * @returns {Promise<void>}
 */
async function waitForWorkerReady() {
  const start = Date.now();

  while (Date.now() - start < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) {
        return;
      }
    } catch {
      // Worker still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Wrangler 本地服务启动超时。');
}

/**
 * Request an API path from local worker.
 *
 * @param {string} path
 * @returns {Promise<Response>}
 */
async function apiRequest(path) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'mirror-worker-integration-test/1.0'
    }
  });
}

/**
 * Read all supported mirror prefixes from worker proxy map.
 *
 * @returns {Promise<string[]>}
 */
async function getSupportedPrefixes() {
  const source = await readFile(WORKER_FILE, 'utf8');
  const matches = [...source.matchAll(/prefix:\s*'([^']+)'/g)];
  const prefixes = matches
    .map((item) => item[1])
    .filter((item) => /^(\/language|\/system|\/container|\/tool)\//.test(item));

  return [...new Set(prefixes)];
}

before(async () => {
  workerProcess = spawn(
    'npx',
    ['-y', 'wrangler@4.73.0', 'dev', '--local', '--port', '8787', '--ip', '127.0.0.1'],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '0'
      }
    }
  );

  workerProcess.stderr?.on('data', () => {
    // 保持 stderr 被消费，避免缓冲区阻塞。
  });
  workerProcess.stdout?.on('data', () => {
    // 保持 stdout 被消费，避免缓冲区阻塞。
  });

  await waitForWorkerReady();
});

after(async () => {
  if (!workerProcess || workerProcess.killed) {
    return;
  }

  workerProcess.kill('SIGTERM');

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!workerProcess.killed) {
        workerProcess.kill('SIGKILL');
      }
      resolve();
    }, 5_000);

    workerProcess.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
});

test('首页返回 200 且包含导航内容', async () => {
  const response = await apiRequest('/');
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
  assert.match(body, /镜像源导航|Mirror Navigation/);
});

test('未知路径返回 404', async () => {
  const response = await apiRequest('/__integration_test_not_found__');
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(body, /404 Not Found/);
});

const mirrorChecks = [
  { name: 'NPM', path: '/language/npm/' },
  { name: 'Ubuntu', path: '/system/ubuntu/' },
  { name: 'Docker Registry', path: '/container/docker/' },
  { name: 'Anaconda', path: '/tool/anaconda/' }
];

for (const item of mirrorChecks) {
  test(`镜像 API: ${item.name} 返回状态符合要求`, async () => {
    const response = await apiRequest(item.path);
    const body = await response.text();

    assert.ok(response.status < 500, `${item.name} 不应返回 5xx`);
    assert.ok(
      !/路径未匹配任何镜像规则|404 Not Found/.test(body),
      `${item.name} 命中了本地未匹配路由，而不是上游镜像响应`
    );
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
}

test('支持镜像列表与 API 覆盖校验', async () => {
  const prefixes = await getSupportedPrefixes();

  assert.equal(prefixes.length, 42, '当前支持镜像前缀数量应为 42');

  const results = await Promise.all(
    prefixes.map(async (prefix) => {
      const response = await apiRequest(prefix);
      const contentType = response.headers.get('content-type') ?? '';
      const shouldReadBody = response.status === 404 || /text|json|xml|html/i.test(contentType);
      const body = shouldReadBody ? await response.text().catch(() => '') : '';

      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.ok(
        !/路径未匹配任何镜像规则/.test(body),
        `${prefix} 命中了本地未匹配路由，而不是上游镜像响应`
      );

      return { prefix, status: response.status };
    })
  );

  assert.equal(results.length, prefixes.length);
});
