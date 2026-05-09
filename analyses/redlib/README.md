# Redlib 架构分析

> 分析版本：v0.36.0 ｜ 分析日期：2026-05-09

## 1. 项目概览

| 项目 | 官网 | GitHub | 编程语言 | Star 数 | 许可证 | 核心维护者 |
|------|------|--------|----------|---------|--------|------------|
| Redlib | N/A | https://github.com/redlib-org/redlib | Rust | ~6k | AGPL-3.0-only | 社区维护 |

**项目简介**: Reddit 的替代性私有前端（源自 Libreddit），采用 Rust 编写，零 unsafe 代码。通过自建轻量级 HTTP 框架、模拟官方客户端 OAuth 流程、以及基于 Cookie 的无状态持久化，在 6,700 行 Rust 代码中实现了隐私优先、高性能的 Reddit 浏览体验。

## 2. 技术栈

| 类别 | 技术选型 |
|------|----------|
| 编程语言 | Rust (EDITION 2021)，要求 ≥ 1.81 |
| 构建系统 | Cargo |
| 测试框架 | 内置 `#[test]`、`#[tokio::test]`、`sealed_test` |
| CI/CD | GitHub Actions（多工作流：构建、Docker、PR 检查、跨平台构件） |
| 存储 | 无数据库；用户偏好设置存储于浏览器 Cookie |
| 通信协议 | HTTP/HTTPS（基于 Hyper v0.14） |
| HTTP 服务端 | Hyper v0.14 |
| 路由 | route-recognizer |
| 模板引擎 | Askama v0.14（编译时类型安全模板） |
| HTTP 客户端 | wreq v6.0 |
| JSON 处理 | serde_json |
| 缓存 | cached v0.59（基于 proc-macro 的惰性缓存） |
| 压缩 | libflate (gzip) + brotli |
| Markdown | pulldown-cmark |

## 3. 整体架构

```mermaid
graph TB
    subgraph "启动层"
        main[main.rs]
        buildrs[build.rs<br/>注入 GIT_HASH]
    end

    subgraph "核心框架"
        server[server.rs<br/>自定义 HTTP 框架]
        server --> route[route-recognizer<br/>URL 路由]
        server --> compress[内容协商压缩<br/>Brotli / Gzip]
    end

    subgraph "配置层"
        config[config.rs<br/>Env → TOML → 默认值 优先级链]
        instance_info[instance_info.rs<br/>运行时实例信息]
    end

    subgraph "Reddit API 层"
        client[client.rs<br/>API 客户端 + 缓存]
        oauth[oauth.rs<br/>OAuth 令牌管理]
    end

    subgraph "页面处理层"
        subreddit[subreddit.rs<br/>子版块 / 首页]
        post[post.rs<br/>帖子详情 + 评论树]
        user[user.rs<br/>用户资料]
        search[search.rs<br/>搜索]
        settings[settings.rs<br/>Cookie 偏好设置]
    end

    subgraph "表现层"
        templates[templates/<br/>15 个 Askama .html 模板]
        static_assets[static/<br/>CSS (19 主题), JS, 图标]
    end

    main --> server
    main --> client
    server --> subreddit & post & user & search & settings
    subreddit & post & user & search --> client
    client --> oauth
```

### 架构分层

- **启动层**：程序入口点 `main.rs`，通过 `build.rs` 注入当前 Git 哈希。负责 CLI 参数解析、路由注册、启动前健康检查。
- **核心框架层**：基于 Hyper 和 route-recognizer 自建的轻量 HTTP 框架，提供路由匹配、内容协商压缩等。
- **配置层**：从环境变量、TOML 文件、默认值的优先级链加载配置。
- **Reddit API 层**：HTTP 客户端和 OAuth 令牌管理，支持缓存、速率限制追踪、重定向处理。
- **页面处理层**：每个页面类型对应一个处理模块，从客户端获取数据并渲染模板。
- **表现层**：Askama 模板生成 HTML，静态资源通过 RustEmbed 编译进二进制文件。

### 模块职责

| 模块 | 职责 | 关键文件/目录 |
|------|------|---------------|
| `main.rs` | 入口点、CLI 参数解析、路由注册 | `/src/main.rs` |
| `server.rs` | 自定义 HTTP 框架 | `/src/server.rs` |
| `client.rs` | Reddit API 抽象层 | `/src/client.rs` |
| `oauth.rs` | OAuth 令牌生命周期管理 | `/src/oauth.rs` |
| `config.rs` | 分层配置加载 | `/src/config.rs` |
| `utils.rs` | 数据模型、URL 重写、媒体解析 | `/src/utils.rs` |
| `subreddit.rs` | 子版块/首页渲染 | `/src/subreddit.rs` |
| `post.rs` | 帖子详情 + 评论树 | `/src/post.rs` |
| `settings.rs` | Cookie 偏好设置 CRUD | `/src/settings.rs` |
| `templates/` | 15 个 Askama 模板 | `/templates/` |
| `static/` | CSS (19 主题), JS, 图标 | `/static/` |

## 4. 核心模块详解

### 4.1 自定义 HTTP 框架（`server.rs`）

Redlib 没有使用 Actix-Web 或 Axum，而是基于 Hyper 和 `route-recognizer` 构建了自己的框架。路由注册使用流畅风格的构建器 API：`app.at("/r/:sub").get(fn).post(fn)`。路由匹配将 HTTP 方法编码到路径字符串中。

**内容协商压缩**：解析 `Accept-Encoding` 头，支持 q 值权重，智能选择 Brotli 或 Gzip，响应体压缩结果带有 10 分钟 TTL 缓存。

### 4.2 OAuth 令牌管理（`oauth.rs`）

核心设计决策：Redlib **模拟官方的 Reddit Android 客户端**来获取自己的 API 令牌，不需要用户进行 OAuth 认证。

**双后端策略（策略模式）**：
- **`MobileSpoofAuth`**：模拟 Android Reddit 应用（默认选择）
- **`GenericWebAuth`**：标准 Web 授权端点获取令牌（连续 5 次失败后激活）

`ArcSwap<Oauth>` 提供了无锁读取，同时允许原子式实时替换令牌。

### 4.3 HTTP 客户端层（`client.rs`）

Wreq 客户端配置了浏览器模拟（Chrome 145 / Firefox 147 随机选择，Android / Windows 随机切换）。请求头随机打乱以减少基于模式的指纹识别。

**媒体代理**：`/img/*`、`/vid/*`、`/hls/*` 端点通过 Redlib 透明代理所有 Reddit 媒体，确保没有直接浏览器到 Reddit 的请求。

### 4.4 用户偏好设置系统

所有偏好设置存储在浏览器 Cookie 中——完全无服务器的用户状态。通过 `bincode` 序列化 + `deflate` 压缩 + `base2048` 编码导出为紧凑字符串。

**分片 Cookie**：订阅列表超过单域名 Cookie 的 4KB 限制时，`join_until_size_limit()` 函数将长列表切分为多个 Cookie，在读取时无缝重组。

## 5. 关键设计决策

| 决策 | 选择 | 替代方案 | 理由 |
|------|------|----------|------|
| 零 JavaScript 服务端渲染 | 所有页面通过 Askama 服务端渲染 | React/Vue 等 SPA | 极佳隐私、极致速度、强安全 |
| 客户端模拟 OAuth | 模拟官方 Android 应用 | 要求用户 OAuth 认证 | 更高的速率限制，用户保持完全匿名 |
| 基于 Cookie 持久化 | 偏好设置存储在浏览器 Cookie | 服务端数据库 | 无状态服务器，简化水平扩展 |
| 自建 HTTP 框架 | Hyper + route-recognizer | Axum / Actix-Web | 编译时间更短，依赖更少 |
| 双后端 OAuth | MobileSpoofAuth + GenericWebAuth | 单一策略 | 一个后端被封锁不影响实例 |

## 6. 数据流 / 请求流

```mermaid
sequenceDiagram
    participant U as 用户浏览器
    participant S as Redlib 服务器
    participant C as 缓存
    participant OA as OAuth 令牌
    participant RA as Reddit API

    U->>S: GET /r/rust
    S->>S: server.recognize("/GET/r/rust")
    S->>S: Preferences::new(&req) 从 Cookie 解析
    S->>C: 检查 json() 缓存 ttl=30s
    alt 缓存命中
        C-->>S: 返回缓存的 JSON
    else 缓存未命中
        S->>OA: 读取 Authorization 头
        OA-->>S: Bearer &lt;token&gt;
        S->>RA: GET /r/rust/about.json (伪造头)
        RA-->>S: JSON + x-ratelimit-remaining
        S->>S: 解析 JSON → Subreddit
        S->>C: 缓存
    end
    S->>S: filter_posts() 移除过滤的帖子
    S->>S: Askama 渲染 HTML
    S->>S: Brotli/Gzip 压缩（缓存 10 分钟）
    S->>U: 200 OK (压缩 HTML)
```

## 7. 设计模式

| 模式名称 | 使用位置 | 目的 |
|---------|----------|------|
| 策略模式 | `oauth.rs` | OauthBackend trait + MobileSpoofAuth / GenericWebAuth 实现 |
| 构建器模式 | `server.rs` | 流畅的 `app.at(path).get(fn).post(fn)` 路由 API |
| 代理模式 | `client.rs` | 所有 Reddit 媒体通过 Redlib 服务器代理 |
| 模板方法模式 | `templates/` | Askama 的 block 继承体系 |
| 惰性初始化 | 多处 | `LazyLock` 用于配置、OAuth 客户端、正则表达式 |
| 装饰器模式 | `client.rs` | RequestExt / ResponseExt trait 扩展 Http 类型 |
| 缓存代理 | `client.rs` + `server.rs` | `#[cached]` proc-macro 实现 TTL 缓存 |

## 8. 工程实践

### 测试策略

| 层级 | 框架 | 覆盖范围 |
|-------|---------|----------|
| 单元测试 | `#[test]` | 辅助函数（format_num、rewrite_urls、format_url） |
| 环境测试 | `sealed_test` | 配置优先级 |
| 集成测试 | `#[tokio::test]` | Reddit API、OAuth 令牌生命周期 |
| 压缩测试 | 手动 | Brotli/Gzip 编解码校验 |
| 安全 | `#![forbid(unsafe_code)]` | 零 unsafe 代码保证 |

OAuth 集成测试会针对真实的 Reddit API 端点执行，验证 token 获取和刷新是否真正有效。

### 发布流程

1. 推送到 `main` → 构建静态二进制（`x86_64-unknown-linux-musl`）
2. GitHub Release → 标签推送，crates.io 发布
3. Docker 构建 → 推送 Quay.io

CI/CD 流水线：`main-rust.yml`（构建+发布）、`main-docker.yml`（多平台 Docker）、`pull-request.yml`（测试+clippy）、`build-artifacts.yml`（跨平台构件）。

### 版本管理

当前版本 v0.36.0，通过 `build.rs` 注入 GIT_HASH，语义化版本管理。Docker 多阶段构建使用 Alpine 基础镜像。

## 9. 总结与评价

### 亮点

- **隐私至上**：用户与 Reddit 之间零直接接触，所有媒体通过代理，无客户端 JavaScript
- **极致性能**：服务端渲染、响应压缩、多层缓存（JSON 30s TTL，压缩 10min TTL）
- **部署简单**：单二进制 + 零外部依赖（无数据库、无运行时）
- **零 unsafe 代码**：通过 `#![forbid(unsafe_code)]` 保证内存安全
- **工程简洁**：6,700 行 Rust 代码实现了完整前端
- **丰富的主题系统**：19 个 CSS 主题编译进二进制

### 可改进之处

- **自定义框架的生态限制**：无中间件体系，无请求体提取等开箱即用功能
- **Cookie 分片复杂度**：订阅列表切分和重组增加了代码复杂度
- **被 Reddit 反爬机制封禁的风险**：持续存在的风险
- **交互受限**：无无限滚动、无实时更新，仅限浏览功能
- **启动延迟**：双后端 OAuth 回退机制最多导致 25 秒额外启动时间

## 参考

本分析基于项目源代码及文档（https://github.com/redlib-org/redlib）。
