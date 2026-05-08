# Miniflux 架构分析

> 分析版本：v2.2.19 ｜ 分析日期：2026-05-08

## 1. 项目概览

| 项目 | 信息 |
|------|------|
| 官网 | https://miniflux.app |
| GitHub | https://github.com/miniflux/v2 |
| 编程语言 | Go (1.26) |
| Star 数 | ~9,100 |
| 许可证 | Apache-2.0 |
| 核心维护者 | Frédéric Guillot (fguillot) |

**项目简介**

Miniflux 是一个极简主义、有主见的 RSS 阅读器，以单二进制文件部署。它专注于干净、高效的阅读体验，支持自托管，提供 REST API、Fever API 和 Google Reader API 兼容层，并与 30+ 第三方服务集成。

## 2. 技术栈

| 类别 | 技术选型 |
|------|----------|
| 编程语言 | Go 1.26（使用泛型 `go 1.26.0`） |
| 构建系统 | Makefile + Go 原生构建 |
| 测试框架 | Go 标准 `testing` 包 + `testify` |
| CI/CD | GitHub Actions（tests / linters / build / docker / debian-packages / rpm / codeql） |
| 存储 | PostgreSQL（仅支持 PG，无 SQLite） |
| 通信协议 | HTTP/HTTPS, Web 界面, REST API, Fever API, Google Reader API |
| 前端 | 服务端渲染 HTML + CSS + JavaScript（无前端框架） |
| 日志 | `log/slog`（Go 1.21+ 结构化日志） |
| 指标监控 | Prometheus (`prometheus/client_golang`) |
| 容器化 | Docker（Alpine + Distroless） |
| 包管理 | RPM, Debian 包 |

## 3. 整体架构

### 高层架构图

```mermaid
graph TB
    subgraph "客户端层"
        Browser["🌐 浏览器<br/>(Web UI)"]
        ClientApp["📱 第三方客户端<br/>(REST / Fever / GReader API)"]
    end

    subgraph "HTTP 路由层"
        Router["📡 HTTP Router<br/>(net/http.ServeMux)"]
        Middleware["🛡️ 中间件链<br/>(Logging / CORS / Auth / CSRF / Session)"]
    end

    subgraph "API 层"
        REST["REST API v1<br/>internal/api/"]
        Fever["Fever API 兼容<br/>internal/fever/"]
        GReader["Google Reader API 兼容<br/>internal/googlereader/"]
    end

    subgraph "UI 层"
        UI["Web UI Handler<br/>internal/ui/"]
        Template["模板引擎<br/>internal/template/"]
        Locale["国际化<br/>internal/locale/"]
    end

    subgraph "业务逻辑层"
        Reader["📖 Feed Reader<br/>internal/reader/"]
        Integration["🔗 第三方集成<br/>internal/integration/"]
        WorkerPool["⚙️ Worker Pool<br/>internal/worker/"]
        Scheduler["⏰ Feed Scheduler<br/>internal/cli/"]
    end

    subgraph "数据访问层"
        Storage["🗄️ Storage (Repository)<br/>internal/storage/"]
        Model["📦 Domain Models<br/>internal/model/"]
    end

    subgraph "基础设施层"
        DB[("🐘 PostgreSQL")]
        Config["⚙️ 配置解析<br/>internal/config/"]
        HTTPClient["🌍 HTTP Client<br/>internal/http/client/"]
        ProxyRotator["🔄 代理轮转<br/>internal/proxyrotator/"]
        MediaProxy["🖼️ 媒体代理<br/>internal/mediaproxy/"]
        Metric["📊 Prometheus 指标<br/>internal/metric/"]
        OAuth["🔐 OAuth2 认证<br/>internal/oauth2/"]
        Crypto["🔑 加密工具<br/>internal/crypto/"]
    end

    Browser --> Router
    ClientApp --> Router
    Router --> Middleware
    Middleware --> REST
    Middleware --> Fever
    Middleware --> GReader
    Middleware --> UI
    UI --> Template
    UI --> Locale
    REST --> Storage
    Fever --> Storage
    GReader --> Storage
    UI --> Storage
    Storage --> Model
    Storage --> DB
    Scheduler --> Storage
    Scheduler --> WorkerPool
    WorkerPool --> Reader
    Reader --> HTTPClient
    Reader --> ProxyRotator
    Reader --> Storage
    Reader --> Integration
    Integration --> HTTPClient
    Config -.->|全局访问| Reader
    Config -.->|全局访问| WorkerPool
    Config -.->|全局访问| HTTPClient
    Metric -.-> Storage
    Metric -.-> WorkerPool
```

### 架构分层

Miniflux 采用分层架构，代码组织在 `internal/` 下，按职责划分为以下层次：

| 层 | 说明 |
|------|------|
| **路由&中间件层** | Go 1.22+ 的 `http.ServeMux` 路由 + 自定义中间件链 |
| **API 层** | REST API v1、Fever API、Google Reader API 三个平行的 API 接口 |
| **UI 层** | 服务端渲染的 Web 界面，使用自定义模板引擎 |
| **业务逻辑层** | Feed Reader（核心）、第三方集成、Worker Pool、调度器 |
| **数据访问层** | Repository 模式 + Query Builder 模式 |
| **基础设施层** | PostgreSQL 连接池、HTTP 客户端、配置、认证等 |

### 模块职责

| 模块 | 职责 | 关键文件/目录 |
|------|------|---------------|
| `cli` | 入口点、CLI 标志解析、守护进程启动 | `main.go` → `internal/cli/cli.go` → `internal/cli/daemon.go` |
| `config` | 配置解析（环境变量 + 配置文件） | `internal/config/parser.go` |
| `database` | PostgreSQL 连接池管理与 Schema 迁移 | `internal/database/` |
| `storage` | 数据访问层（Repository + Query Builder） | `internal/storage/` |
| `model` | 领域模型定义（Feed, Entry, User, Category 等） | `internal/model/` |
| `reader` | Feed 抓取、解析、处理、重写 | `internal/reader/` |
| `worker` | Feed 刷新工作池 | `internal/worker/` |
| `http/server` | HTTP 服务器启动与路由 | `internal/http/server/` |
| `http/client` | HTTP 客户端、请求构建 | `internal/http/client/` |
| `api` | REST API v1 | `internal/api/` |
| `ui` | Web UI 处理器（约 60+ 个处理函数） | `internal/ui/` |
| `template` | HTML 模板引擎 | `internal/template/` |
| `integration` | 30+ 第三方服务集成 | `internal/integration/` |
| `fever` | Fever API 兼容层 | `internal/fever/` |
| `googlereader` | Google Reader API 兼容层 | `internal/googlereader/` |
| `locale` | 国际化/本地化 | `internal/locale/` |
| `oauth2` | OAuth2/OIDC 认证 | `internal/oauth2/` |
| `proxyrotator` | HTTP 代理轮转 | `internal/proxyrotator/` |
| `metric` | Prometheus 指标收集 | `internal/metric/` |

## 4. 核心模块详解

### 4.1 入口与 CLI 层 (`internal/cli/`)

```mermaid
flowchart LR
    A["main.go<br/>cli.Parse()"] --> B{"cli.go<br/>Flag Parsing"}
    B --> C["配置加载<br/>(环境变量 + 配置文件)"]
    B --> D["一次性命令<br/>(迁移/创建管理员/导出等)"]
    B --> E["daemon.go<br/>startDaemon()"]
    E --> F["🖥️ HTTP 服务器<br/>server.StartWebServer()"]
    E --> G["⚙️ Worker Pool<br/>worker.NewPool()"]
    E --> H["⏰ 调度器<br/>runScheduler()"]
    E --> I["📊 指标收集<br/>metric.NewCollector()"]
```

**设计亮点：** Miniflux 使用 CLI 标志模式实现多入口行为。同一二进制既可以作为长期守护进程运行，也可以执行一次性管理任务（迁移数据库、创建管理员、刷新会话等）。通过 `flag` 包解析命令行参数，根据标志决定执行路径。

关键代码路径：
```
main.go → cli.Parse()
  ├── flag 解析 → config 加载
  ├── --migrate → database.Migrate()
  ├── --create-admin → createAdminUserFromInteractiveTerminal()
  ├── --refresh-feeds → refreshFeeds()
  ├── --healthcheck → doHealthCheck()
  └── (默认) → startDaemon()
      ├── database.Migrate()
      ├── proxyrotator.Initialize()
      ├── worker.NewPool()
      ├── runScheduler() (feed + cleanup)
      ├── server.StartWebServer()
      └── metric.NewCollector()
```

### 4.2 Feed Reader 核心 (`internal/reader/`)

这是 miniflux 的核心功能模块，处理 Feed 的抓取、解析、处理和重写。

```mermaid
flowchart TD
    A["🌐 Feed URL"] --> B["fetcher/ 请求构建<br/>(ETag/Last-Modified/代理)"]
    B --> C{"响应处理"}
    C -->|"304 Not Modified"| D["跳过更新"]
    C -->|"200 OK"| E["ReadBody<br/>读取响应体"]
    E --> F{"格式检测"}
    F -->|"Atom"| G["atom/ 解析器"]
    F -->|"RSS"| H["rss/ 解析器"]
    F -->|"JSON Feed"| I["json/ 解析器"]
    F -->|"RDF"| J["rdf/ 解析器"]
    G & H & I & J --> K["统一 Feed 模型<br/>(model.Feed)"]
    K --> L["processor/ 条目处理<br/>(清洗/去重/媒体处理)"]
    L --> M["rewrite/ 内容重写<br/>(XPath 规则/清理)"]
    M --> N["scraper/ 全文抓取"]
    N --> O["sanitizer/ HTML 净化"]
    O --> P["storage/ 持久化"]
```

**Feed 刷新流程（核心请求处理）：**

```mermaid
sequenceDiagram
    participant Scheduler
    participant BatchBuilder
    participant Pool as Worker Pool
    participant Handler as reader/handler
    participant Fetcher as reader/fetcher
    participant Parser as reader/parser
    participant Processor as reader/processor
    participant Storage as storage
    participant Integration as integration

    Scheduler->>BatchBuilder: 定时触发<br/>(默认每60秒)
    BatchBuilder->>Storage: SELECT feeds WHERE next_check_at < now()
    Storage-->>BatchBuilder: 返回过期 feeds
    BatchBuilder-->>Scheduler: JobList
    Scheduler->>Pool: Push(jobs)
    
    loop 每个 job
        Pool->>Handler: RefreshFeed(store, userID, feedID)
        Handler->>Fetcher: 构建请求 (ETag/Last-Modified/代理)
        Fetcher->>External: GET feed_url
        External-->>Fetcher: HTTP Response
        Fetcher-->>Handler: ResponseHandler
        
        alt 304 Not Modified
            Handler->>Storage: UpdateFeed(etag, checked_at)
        else 200 OK
            Handler->>Parser: ParseFeed(body)
            Parser-->>Handler: *model.Feed
            Handler->>Processor: ProcessFeedEntries
            Processor->>Processor: 重写/清洗/去重
            Processor-->>Handler: 处理后的条目
            Handler->>Storage: RefreshFeedEntries
            Storage-->>Handler: newEntries
            alt 有新条目 && 用户配置了集成
                Handler->>Integration: PushEntries (异步 goroutine)
                Integration->>External: 推送到第三方服务
            end
            Handler->>Storage: UpdateFeed (持久化)
        end
    end
```

**Feed 格式解析策略：**

`internal/reader/parser/parser.go` 使用 **策略模式** 自动检测并选择合适的 Feed 格式解析器：

```go
func ParseFeed(baseURL string, r io.ReadSeeker) (*model.Feed, error) {
    format, version := DetectFeedFormat(r)
    switch format {
    case FormatAtom: return atom.Parse(baseURL, r, version)
    case FormatRSS:  return rss.Parse(baseURL, r)
    case FormatJSON: return json.Parse(baseURL, r)
    case FormatRDF:  return rdf.Parse(baseURL, r)
    default: return nil, ErrFeedFormatNotDetected
    }
}
```

**配置规则系统：** 每个 Feed 可以独立配置以下规则集：
- **Scraper Rules** (`scraper/`) — XPath/CSS 选择器提取全文
- **Rewrite Rules** (`rewrite/`) — 内容重写规则（删除广告、替换元素等）  
- **URL Rewrite Rules** — URL 重写
- **Blocklist / Keeplist Rules** — 条目过滤
- **Block/Keep Filter Entry Rules** — 基于关键词筛选

### 4.3 调度器与 Worker Pool

Miniflux 有两种调度策略：

| 策略 | 说明 | 配置 |
|------|------|------|
| **Round Robin** | 固定轮询间隔，所有 feed 平等对待 | `POLLING_SCHEDULER=round_robin` |
| **Entry Frequency** | 根据 feed 每周平均条目数动态调整轮询频率 | `POLLING_SCHEDULER=entry_frequency` |

**调度算法** (`internal/model/feed.go` — `ScheduleNextCheck`)：

1. 默认使用 `POLLING_FREQUENCY`（Round Robin 模式）或根据周条目数计算（Entry Frequency 模式）
2. 取 RSS TTL / Cache-Control / Expires / Retry-After 中最大值作为 refresh delay
3. 最终间隔 = max(计算值, refresh_delay)，并限制在 `MIN_INTERVAL` ~ `MAX_INTERVAL` 之间

**Worker Pool** (`internal/worker/`)：
- 使用 Go channel 作为任务队列
- `NewPool()` 创建指定数量的 worker goroutine
- 每个 worker 从 channel 消费 `model.Job` 并调用 `handler.RefreshFeed()`
- 优雅关闭通过 `close(queue)` + `sync.WaitGroup` 实现

**Batch Builder** (`internal/storage/batch.go`)：
- 使用 **建造者模式** 构造 SQL 查询
- 支持按用户、分类、错误计数、禁用状态等条件过滤
- 支持 `limitPerHost` 防止短时间内对同一域名过度请求

### 4.4 HTTP 路由与中间件

```mermaid
flowchart TD
    A["HTTP 请求"] --> B["rootMux"]
    B --> C["/liveness, /healthz<br/>/readiness, /readyz"]
    B --> D{"basePath<br/>前缀解析"}
    D --> E["中间件链"]
    E --> F["appMux"]
    
    subgraph "appMux 路由"
        F --> G["GET /healthcheck"]
        F --> H["/fever/ -> Fever Handler"]
        F --> I["POST /accounts/ClientLogin<br/>→ Google Reader Handler"]
        F --> J["/reader/api/0/ → Google Reader"]
        F --> K["/v1/ → REST API"]
        F --> L["/metrics → Prometheus"]
        F --> M["/ (catch-all) → Web UI"]
    end

    subgraph "中间件链 (middleware)"
        N["日志记录 (slog)"]
        O["客户端IP识别"]
        P["HSTS 头设置"]
    end
    
    E --> N --> O --> P
```

**路由特点** (`internal/http/server/routes.go`)：
- 使用 Go 1.22+ 的 `http.ServeMux` 新模式路由（`"GET /path/{param}"`）
- 支持 `basePath` 前缀剥离
- 健康检查端点在根路径（绕过 basePath）
- 每层路由都可以独立启动/禁用（如 Metrics 可配、API 可配）

**认证中间件链** (REST API)：
```
CORS → API Key 验证 → Basic Auth 验证 → Handler
```

**UI 中间件链**：
```
Web Session 恢复 → CSRF 保护 → Auth Proxy → Handler
```

### 4.5 存储层 (`internal/storage/`)

```mermaid
flowchart LR
    subgraph "Repository 模式"
        A["Storage<br/>(*sql.DB 持有者)"]
        A --> B["FeedStore<br/>(查/增/改 Feed)"]
        A --> C["EntryStore<br/>(查/增/改/统计条目)"]
        A --> D["UserStore<br/>(用户管理)"]
        A --> E["CategoryStore"]
        A --> F["IntegrationStore"]
        A --> G["BatchBuilder"]
    end
    
    subgraph "Query Builder 模式"
        H["EntryQueryBuilder"]
        I["FeedQueryBuilder"]
        J["EntryPaginationBuilder"]
    end
    
    B --> H & I
    C --> H & J
    D --> A
```

**设计亮点：**
- **不依赖 ORM** — 手写 SQL，完全控制查询性能和优化
- **Query Builder 模式** — 链式调用构造复杂查询（过滤、排序、分页）
- **每存储文件一个实体** — 职责清晰，单个文件通常 200-500 行
- **事务支持** — 关键操作使用数据库事务保证一致性

示例 — EntryQueryBuilder：
```go
queryBuilder := store.NewEntryQueryBuilder(userID)
queryBuilder.WithStatus(model.EntryStatusUnread)
queryBuilder.WithFeedID(feedID)
queryBuilder.WithSorting("published_at", "desc")
queryBuilder.WithLimit(100)
entries, err := queryBuilder.GetEntries()
```

### 4.6 第三方集成层 (`internal/integration/`)

Miniflux 支持 30+ 第三方服务，采用 **策略模式** 统一接口：

```mermaid
flowchart TD
    A["用户阅读时点击 'Save'"] --> B["integration.SendEntry()"]
    B --> C["根据用户配置<br/>逐个推送"]
    
    C --> D["Pinboard / Instapaper / Wallabag / Shaarli<br/>... 书签服务"]
    C --> E["Apprise / Ntfy / Pushover / Matrix / Slack / Telegram<br/>... 通知服务"]
    C --> F["Linkding / Linkace / Linkwarden / Readeck<br/>... 自托管书签"]
    C --> G["Omnivore / Readwise / Raindrop / Cubox<br/>... 阅读/书签管理器"]
    C --> H["Notion / Archive.org / Webhook"]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
```

**推送时机：**
1. **自动推送** — Feed 刷新时，新条目自动推送到配置的服务（如 Ntfy、Pushover、Webhook）
2. **手动保存** — 用户点击"保存"按钮时，推送到书签/稍后读服务（如 Pinboard、Instapaper）

**实现模式：** 每个集成是一个独立子包，实现统一的客户端结构体和方法，在 `integration/integration.go` 中组合调度。

### 4.7 API 兼容层

```mermaid
flowchart LR
    subgraph "API 兼容层"
        REST["REST API v1<br/>internal/api/"]
        Fever["Fever API<br/>internal/fever/"]
        GReader["Google Reader API<br/>internal/googlereader/"]
    end
    
    subgraph "客户端"
        Miniflux["Miniflux Web UI"]
        Reeder["Reeder (macOS/iOS)"]
        NetNewsWire["NetNewsWire"]
        NewsBlur["NewsBlur 客户端"]
    end
    
    Miniflux -->|原生 REST API| REST
    Reeder -->|Fever API| Fever
    NetNewsWire -->|Google Reader API| GReader
    NewsBlur -->|Google Reader API| GReader
    
    REST & Fever & GReader --> Storage
```

**设计权衡：** 实现 Fever 和 Google Reader API 兼容层使 Miniflux 能直接使用现有生态的 RSS 阅读器客户端，无需开发原生移动应用。这是典型的"兼容性"设计策略。

## 5. 关键设计决策

| 决策 | 选择 | 替代方案 | 理由 |
|------|------|----------|------|
| **数据库选型** | 仅 PostgreSQL | SQLite, MySQL | PostgreSQL 成熟、功能丰富、适合自托管服务器场景；设计决策明确排除嵌入式数据库 |
| **前端渲染** | 服务端渲染（Go 模板） | React/Vue SPA | 极简主义哲学，避免 JS 捆绑。使用 Go `html/template` 生成静态 HTML |
| **HTTP 路由** | Go 1.22+ `http.ServeMux` | gorilla/mux, chi | 减少依赖，利用 Go 标准库新模式路由（路径参数、方法匹配） |
| **Feed 调度** | 两种调度策略 | 仅固定轮询 | 灵活适配不同场景：Round Robin 保证公平，Entry Frequency 自适应活跃度 |
| **认证方式** | 多种并存（本地/OAuth2/代理/WebAuthn） | 单一认证 | 适配不同部署场景（个人/企业/反向代理） |
| **API 兼容** | Fever + Google Reader | 仅 REST API | 零投入获取移动端生态支持 |
| **日志** | `log/slog` 结构化日志 | `logrus`, `zap` | Go 1.21+ 标准库，无需外部依赖 |
| **Worker 并发** | Channel + Goroutine Pool | 第三方队列（Redis/AMQP） | 简单可靠，无外部依赖，适合单进程部署 |
| **HTML 净化** | 自实现 sanitizer | `bluemonday` | 更轻量，仅需支持 RSS 常用标签 |
| **CSS/JS 打包** | 运行时内联嵌入 | 构建时打包 | 单二进制部署，无需外部资源文件 |

### 关键权衡详解

**1. 为什么只有 PostgreSQL？**

> 源码中没有存储抽象层或 ORM，所有 SQL 都是手写的 PostgreSQL 专有语法。这是明确的设计决定：支持多数据库会增加显著的维护成本，而 Miniflux 面向自托管服务器场景，PostgreSQL 是最佳选择。

**2. 为什么不使用前端框架？**

> Miniflux 的极简哲学延伸到了前端。所有页面是服务端渲染的 HTML，通过 Go 的 `html/template` 生成。少量 JavaScript 用于增强交互（标记已读、键盘快捷键等），但整体 JS 代码量极小。这带来了极低的客户端负载和零构建步骤。

**3. 为什么不用 ORM？**

> Go 的 `database/sql` 加上手写 SQL 和 Query Builder 模式提供了完全的控制力。对于 Miniflux 这样数据模型清晰、查询模式固定的应用，ORM 会增加复杂性和性能开销。

## 6. 数据流 / 请求流

### Feed 刷新流程（核心）

```mermaid
sequenceDiagram
    participant Cron as "调度器 (60s 定时器)"
    participant DB as "PostgreSQL"
    participant Batch as "Batch Builder"
    participant Worker as "Worker Goroutine"
    participant Fetcher as "Fetcher<br/>(HTTP Client)"
    participant Parser as "Parser<br/>(Atom/RSS/JSON/RDF)"
    participant Processor as "Processor"
    participant Integration as "第三方集成"

    Cron->>DB: 查询过期 feeds (next_check_at < now())
    DB-->>Cron: 返回 jobs (limit batch_size, 限制 per host)
    Cron->>Worker: Push jobs to channel
    Worker->>Fetcher: 构建 HTTP 请求 (含 ETag/Last-Modified)
    Fetcher->>Source: GET feed_url
    Source-->>Fetcher: 304 Not Modified
    Fetcher-->>Worker: 未修改，跳过
    Worker->>DB: 更新 checked_at
    Note over Worker,Source: 或...
    Source-->>Fetcher: 200 OK + body
    Fetcher-->>Worker: 响应体
    Worker->>Parser: ParseFeed(body)
    Parser-->>Worker: *model.Feed
    Worker->>Processor: ProcessFeedEntries (重写/清洗/去重)
    Processor->>Worker: 处理的条目
    Worker->>DB: RefreshFeedEntries (批量插入/更新)
    DB-->>Worker: 新增条目列表
    alt 有新条目 && 用户配置集成
        Worker->>Integration: PushEntries (goroutine)
        Integration->>External: 发送到第三方服务
    end
    Worker->>DB: UpdateFeed (etag, last_modified, next_check_at)
```

### API 请求流

```mermaid
sequenceDiagram
    participant Client as "客户端<br/>(Web/API)"
    participant Router as "rootMux"
    participant Middleware as "中间件链"
    participant Handler as "Handler"
    participant Store as "Storage"
    participant DB as "PostgreSQL"

    Client->>Router: HTTP 请求
    Router->>Middleware: 传递请求
    Middleware->>Middleware: 记录日志、IP 解析、HSTS
    Middleware->>Handler: 路由到对应处理器
    Handler->>Handler: 参数解析与验证<br/>(internal/validator/)
    Handler->>Store: 调用存储层方法
    Store->>DB: SQL 查询 (手写参数化查询)
    DB-->>Store: 查询结果
    Store-->>Handler: 返回领域模型
    Handler->>Handler: 序列化 (JSON/HTML)
    Handler-->>Client: HTTP 响应
```

## 7. 设计模式

| 模式名称 | 使用位置 | 目的 |
|----------|----------|------|
| **建造者模式 (Builder)** | `fetcher.NewRequestBuilder()`, `batchBuilder`, `EntryQueryBuilder` | 链式调用构造复杂请求、查询和批处理 |
| **工作池模式 (Worker Pool)** | `worker.Pool` | 管理 Feed 刷新并发 Worker goroutine |
| **策略模式 (Strategy)** | `parser.ParseFeed()` 分发到 atom/rss/json/rdf 解析器 | 统一 Feed 解析接口，支持多种格式 |
| **仓库模式 (Repository)** | `storage.Storage` 及其方法 | 封装数据访问逻辑，统一数据库操作接口 |
| **中间件模式 (Middleware)** | `middleware()`, API 认证中间件链 | 横切关注点（日志、认证、CORS）解耦 |
| **模板方法模式** | `reader/handler.RefreshFeed()` | 定义 Feed 刷新骨架流程，子步骤由不同模块实现 |
| **适配器模式 (Adapter)** | `rss/adapter.go`, `atom/atom_10_adapter.go`, `rdf/adapter.go` | 将不同 Feed 格式标准化为统一 `model.Feed` |
| **外观模式 (Facade)** | `reader/handler` 包 | 对外提供 `CreateFeed()` / `RefreshFeed()` 简化接口 |
| **选项模式 (Functional Options)** | `config.Opts.*` 全局配置访问 | 通过全局 `config.Opts` 统一访问配置项 |
| **空对象模式 (Null Object)** | 各类 `nil` 安全检查与默认值处理 | 减少 nil 判断，使用零值作为安全默认 |

## 8. 工程实践

### 测试策略

测试层级覆盖：

```
📦 单元测试 ─── go test -cover -race -count=1 ./...
├── model 测试（Entry, Feed 等模型逻辑）
├── reader 测试（解析器、fetcher、重写规则）
├── storage 测试（数据库查询逻辑）
├── locale 测试（国际化）
├── http 测试（请求/响应解析）
└── validator 测试

📦 集成测试 ─── make integration-test
├── 启动真实 Miniflux 实例
├── 使用真实 PostgreSQL
└── ./internal/api 的端到端 API 测试

📦 静态分析 ─── make lint
├── go vet
├── gofmt -l（格式检查）
└── golangci-lint
```

**测试特点：**
- **数据驱动测试** — 大量使用表驱动测试（Table-driven tests）
- **无 mock 框架** — 主要使用真实接口测试，少量接口使用 Go 原生 mock 模式
- **竞态检测** — 始终启用 `-race` 标志
- **跨平台** — CI 在 Ubuntu、Windows、macOS 上运行测试

### CI/CD 流程

```mermaid
flowchart LR
    A["Git Push / PR"] --> B{"GitHub Actions"}
    B --> C["🔬 Tests<br/>(unit + integration)"]
    B --> D["📐 Linters<br/>(go vet, gofmt, golangci-lint)"]
    B --> E["🔐 CodeQL<br/>(安全分析)"]
    B --> F["🐳 Docker 构建<br/>(Alpine + Distroless)"]
    B --> G["📦 二进制构建<br/>(8 个平台)"]
    B --> H["📦 Deb/RPM 包"]
    B --> I["🔄 Codeberg 镜像"]
    B --> J["📝 Stale Issue 管理"]
    
    C & D & E --> K{"main 分支"}
    K --> F & G & H
```

**发布流程：**
1. 打 Git Tag（`v2.x.x`）
2. CI 自动构建多平台二进制（linux amd64/arm64/armv5-7/riscv64, darwin, freebsd, openbsd）
3. CI 自动构建 Docker 镜像并推送（Alpine + Distroless）
4. CI 自动构建 RPM 和 Debian 包

### 依赖管理

- 使用 Go modules（`go.mod` / `go.sum`）
- 依赖数量极少（核心依赖仅 12 个）
- Dependabot 自动更新依赖（`.github/dependabot.yml`）

## 9. 总结与评价

### 亮点

1. **极简但不简陋** — 单二进制部署，依赖极少，但功能完整（RSS 阅读、全文抓取、内容重写、30+ 集成）

2. **清晰的模块化** — `internal/` 下按职责严格分层，包之间依赖关系清晰（从 CLI 到 HTTP 到业务逻辑到存储）

3. **优雅的并发模型** — Go channel + goroutine 的 Worker Pool 模式，简洁高效，无需外部队列

4. **明智的设计权衡** — Fever/Google Reader API 兼容轻松获取移动端生态；仅 PostgreSQL 减小维护负担；服务端渲染消除前端复杂性

5. **完善的内容处理** — 支持 XPath/CSS 的全文抓取、HTML 净化、内容重写规则、URL 重写，为不同来源的 Feed 提供灵活的定制能力

6. **多租户架构** — 原生支持多用户、多分类、权限隔离，可作为小型服务运行

### 可改进之处

1. **无缓存层** — 当前所有请求直接查询 PostgreSQL，高频访问的热门条目可以引入内存缓存（如 `freecache`）

2. **无消息队列抽象** — Worker Pool 直接使用内存 channel，无法在多个实例间共享任务。水平扩展时需引入外部队列

3. **全文搜索有限** — 仅依赖 PostgreSQL `tsvector`，对于大量条目搜索性能可能不足

4. **WebSocket 缺失** — 页面需要轮询获取新条目，可以引入 WebSocket 实现实时推送

5. **富文本编辑器** — 目前内容编辑功能较弱，对于需要修改条目的场景支持不足

6. **配置热加载** — 配置修改需要重启进程，可以增加信号处理或监听文件变更

## 参考

- [Miniflux 官方文档](https://miniflux.app/docs/index.html)
- [GitHub 仓库](https://github.com/miniflux/v2)
- [Go 标准库 net/http.ServeMux](https://pkg.go.dev/net/http#ServeMux) (Go 1.22+ 新模式路由)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
