# PROJECT - mirror-worker

## 1. 项目概述
`mirror-worker` 是一个基于 Cloudflare Workers 的通用镜像反向代理服务。
目标是在边缘侧提供稳定、统一的镜像访问入口，降低国内/跨网络环境下包管理与镜像拉取的失败率。

- 运行平台：Cloudflare Workers
- 入口脚本：`mirror-worker.js`
- 部署配置：`wrangler.toml`
- 发布方式：GitHub Actions（仅 `push tags` 触发）

---

## 2. 功能目标（Goals）
1. 提供统一路径规则的镜像代理入口：
   - 语言包管理器：`/language/*`
   - 系统镜像：`/system/*`
   - 容器镜像：`/container/*`
   - 工具镜像：`/tool/*`
2. 首页展示可访问镜像入口与常用换源示例。
3. 透传必要头部并处理 CORS，保证常见客户端可用。
4. 支持 HTTPS 访问与稳定转发，尽量减少源站兼容问题。

---

## 3. 范围（Scope）
### 3.1 当前范围（In Scope）
- 单 Worker 反向代理实现。
- 多镜像源路由映射与转发。
- 基础错误处理与首页说明文档输出。
- 通过 Wrangler 进行部署与干跑验证。



---

## 4. 路由与接口约定
本项目以 HTTP 路径路由规则为主，不提供独立 REST API。

- 首页：`/`
- 语言镜像：`/language/{name}/...`
- 系统镜像：`/system/{name}/...`
- 容器镜像：`/container/{name}/...`
- 工具镜像：`/tool/{name}/...`

说明：
- 路由映射以 `mirror-worker.js` 中 `proxyMap` 配置为准。
- 新增镜像源时必须同步更新 README 示例与路径说明。

### 4.1 当前支持的镜像列表（以 `proxyMap` 为准）

#### 语言包管理器（`/language/*`）
- `pypi`：`/language/pypi/`
- `npm`：`/language/npm/`
- `maven`：`/language/maven/`
- `gradle`：`/language/gradle/`
- `composer`：`/language/composer/`
- `cargo`：`/language/cargo/`
- `rubygems`：`/language/rubygems/`
- `cpan`：`/language/cpan/`
- `ctan`：`/language/ctan/`
- `julia`：`/language/julia/`

#### 操作系统（`/system/*`）
- `centos`：`/system/centos/`
- `centos-stream`：`/system/centos-stream/`
- `ubuntu`：`/system/ubuntu/`
- `debian`：`/system/debian/`
- `alpine`：`/system/alpine/`
- `archlinux`：`/system/archlinux/`
- `arch4edu`：`/system/arch4edu/`
- `blackarch`：`/system/blackarch/`
- `fedora`：`/system/fedora/`
- `opensuse`：`/system/opensuse/`
- `kali`：`/system/kali/`
- `raspbian`：`/system/raspbian/`
- `gentoo`：`/system/gentoo/`
- `freebsd`：`/system/freebsd/`
- `openbsd`：`/system/openbsd/`
- `void`：`/system/void/`
- `rocky`：`/system/rocky/`
- `almalinux`：`/system/almalinux/`

#### 容器与虚拟化（`/container/*`）
- `docker`：`/container/docker/`
- `dockerhub`：`/container/dockerhub/`
- `gcr`：`/container/gcr/`
- `quay`：`/container/quay/`
- `k8s`：`/container/k8s/`
- `ghcr`：`/container/ghcr/`

#### 工具（`/tool/*`）
- `homebrew`：`/tool/homebrew/`
- `anaconda`：`/tool/anaconda/`
- `flutter`：`/tool/flutter/`
- `winget`：`/tool/winget/`
- `chocolatey`：`/tool/chocolatey/`
- `scoop`：`/tool/scoop/`
- `msys2`：`/tool/msys2/`
- `cygwin`：`/tool/cygwin/`

---

## 5. 配置与环境变量
当前部署配置位于 `wrangler.toml`，主配置项如下：
- `name`
- `main`
- `compatibility_date`
- `workers_dev`

GitHub Actions 自动部署（tag 触发）依赖：
- Secret: `CF_API_TOKEN`
- Variable: `CF_ACCOUNT_ID`

> 若后续新增环境变量，必须同步更新：
> 1) `.env.example`（如引入本地运行配置）
> 2) 文档说明
> 3) GitHub Actions Variables/Secrets

---

## 6. 里程碑（Milestones）
### M1 - 可用基础代理
- Worker 路由转发可用。
- 首页与常用镜像入口可访问。

### M2 - 发布自动化
- GitHub Actions 工作流已接入。
- 仅 `vX.Y.Z` tag 触发部署。

### M3 - 质量增强
- 增加最小化自动测试（语法检查 + 请求冒烟 + API 集成测试）。
- 统一错误响应与日志字段。



---

## 7. 质量门槛与验收标准
### 7.1 本地验收
- `node --check mirror-worker.js` 通过。
- `npx wrangler deploy --dry-run` 通过。
- `npx wrangler dev --local` 启动后，`/` 返回 HTTP 200。
- `node --test tests/integration/mirror-api.test.mjs` 通过。

当前集成测试清单（7 项）：
- 首页返回 200 且包含导航内容。
- 未知路径返回 404。
- 镜像 API：NPM 返回状态符合要求。
- 镜像 API：Ubuntu 返回状态符合要求。
- 镜像 API：Docker Registry 返回状态符合要求。
- 镜像 API：Anaconda 返回状态符合要求。
- 支持镜像列表与 API 覆盖校验（自动读取 `proxyMap`，当前覆盖 42 个镜像前缀）。

### 7.2 发布验收
- 使用 `vX.Y.Z` 打 tag 触发 Action。
- Action 成功执行 `wrangler deploy`。
- 生产域名首页可访问，关键镜像路径可用。

---

## 8. 发布与回滚
### 8.1 发布
1. 完成本次 Todo。
2. 通过本地/CI 验证。
3. 用户本地验证通过后打 tag：`vX.Y.Z`。
4. 推送 tag，等待 GitHub Actions 自动部署。

### 8.2 回滚
- 立即打回退 tag（如 `vX.Y.(Z+1)`）并部署已验证版本。
- 必要时回退 `proxyMap` 最近变更并重新发布。

---

## 9. 后续文档规划
- `docs/api/`：若后续引入管理接口，再补充 API 文档。
- `docs/database/`：若后续引入持久化，再补充数据模型文档。

当前版本无数据库依赖，因此 `docs/database/*.md` 暂不适用。
