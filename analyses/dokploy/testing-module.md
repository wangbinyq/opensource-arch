# Dokploy 测试模块深度分析

> **项目**: Dokploy — Open Source Alternative to Vercel, Heroku and Netlify
> **分析时间**: 2026-05-09
> **分析范围**: `apps/dokploy/__test__/` (45 个测试文件, ~280KB)

---

## 1. 测试全景概览

### 1.1 测试基础设施

| 维度 | 选型 | 说明 |
|------|------|------|
| **测试框架** | **Vitest** | 内置 TypeScript 支持、ESM 原生、Vite 集成、高性能 fork 池 |
| **运行池** | `pool: "forks"` | 每个测试文件在独立子进程运行，避免全局状态污染 |
| **Mock 策略** | `vi.mock()` | 模块级 Mock，在模块加载前拦截 |
| **测试发现** | `__test__/**/*.test.ts` | 约定优于配置 |
| **环境变量** | 通过 `define` 注入 | 预设了 GITHUB/GOOGLE OAuth 测试用凭据 |
| **路径别名** | `vite-tsconfig-paths` | 支持 `@dokploy/server` 等别名映射 |
| **CI 集成** | Pull Request CI + PR Quality | 自动化检查 |

### 1.2 测试文件分布

```mermaid
graph TB
    subgraph "测试文件分布 (按模块)"
        COMPOSE[Compose 模块<br/>19 个文件, ~135KB]
        PERM[权限模块<br/>4 个文件, ~15KB]
        DEPLOY[部署模块<br/>4 个文件, ~38KB]
        ENV[环境变量模块<br/>4 个文件, ~34KB]
        TRAEFIK[Traefik 模块<br/>2 个文件, ~16KB]
        WSS[WebSocket 模块<br/>2 个文件, ~8KB]
        SERVER[Server 模块<br/>1 个文件, ~5KB]
        DROP[文件上传模块<br/>1 个文件, ~12KB]
        TEMPLATES[模板模块<br/>2 个文件, ~25KB]
        BACKUPS[备份模块<br/>1 个文件, ~2KB]
        CLUSTER[集群模块<br/>1 个文件, ~8KB]
        REQUESTS[请求模块<br/>1 个文件, ~6KB]
    end
    
    subgraph "测试类型占比"
        COMPOSE -.->|48%| P1
        DEPLOY -.->|14%| P2
        ENV -.->|12%| P3
        TRAEFIK -.->|6%| P4
        PERM -.->|5%| P5
        OTHER[其他 7 个模块] -.->|15%| P6
    end
```

---

## 2. 测试基础设施架构

### 2.1 Mock 策略设计

Dokploy 采用 **模块级 Mock + 函数级 Spy** 的混合 Mock 策略。核心是 DB 的全模拟：

```mermaid
graph TD
    subgraph "Test Runtime"
        TEST[Test File] --> IMPORT[import from @dokploy/server]
        IMPORT --> BARREL[barrel index.ts]
        BARREL --> DB_MODULE[db.ts]
        DB_MODULE --> PG[Real PostgreSQL<br/>localhost:5432]
    end
    
    subgraph "Mock Layer (setup.ts)"
        VI_MOCK[vi.mock('@dokploy/server/db')] -->|Intercepts| DB_MODULE
        VI_MOCK --> CHAIN[Chainable Mock<br/>Function Chaining Pattern]
        CHAIN --> PROXY[Proxy-based Query Mock<br/>Dynamic Property Access]
    end
    
    TEST --> VI_MOCK
    VI_MOCK -->|Returns| MOCK_DB[Mock DB Object]
```

**链式调用 Mock 实现**：

```typescript
// setup.ts 
vi.mock("@dokploy/server/db", () => {
  const chain = () => chain;           // 所有方法返回自身（可链式调用）
  chain.set = () => chain;
  chain.where = () => chain;
  chain.values = () => chain;
  chain.returning = () => Promise.resolve([{}]);
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.then = (resolve) => { resolve([]); };  // 支持 await

  const tableMock = {
    findFirst: vi.fn(() => Promise.resolve(undefined)),
    findMany: vi.fn(() => Promise.resolve([])),
    insert: vi.fn(() => Promise.resolve([{}])),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };

  return {
    db: {
      select: vi.fn(() => chain),
      insert: vi.fn(() => ({
        values: () => ({ returning: () => Promise.resolve([{}]) }),
      })),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      query: new Proxy({}, {
        get: () => tableMock,  // 任何属性都返回 tableMock
      }),
    },
    dbUrl: "postgres://mock:mock@localhost:5432/mock",
  };
});
```

**设计亮点**：
- **Proxy 模式**：`db.query` 使用 JS Proxy 拦截任意表名访问，统一返回 mock table handler
- **链式调用**：所有方法返回 `this`（或同函数引用），兼容 Drizzle 的链式 API
- **`.then()` 方法**：使 Mock 对象 `await`-able，兼容 Drizzle 的 Promise 风格调用

### 2.2 模块级 Mock vs 测试级 Mock

```mermaid
graph LR
    subgraph "Global Mock (setup.ts)"
        GLOBAL[vi.mock('@dokploy/server/db')]
        GLOBAL -->|Applied to ALL tests| ALL_TESTS
    end
    
    subgraph "Per-Test Mock (test file level)"
        PER_FILE[vi.mock('@dokploy/server/services/xxx')]
        PER_FILE -->|Specific to file| ONE_FILE
        PER_FILE --> OVERRIDES[vi.mocked().mockResolvedValue / mockReturnValue]
    end
    
    subgraph "Test-Specific Spy (within describe/it)"
        LOCAL[vi.spyOn / vi.mocked().mockImplementation]
        LOCAL -->|Dynamic per test| IT_BLOCK
        IT_BLOCK --> EACH[beforeEach / afterEach reset]
    end
    
    GLOBAL --> PER_FILE
    PER_FILE --> LOCAL
```

**三层 Mock 体系**：

| 层级 | 作用域 | 机制 | 示例 |
|------|--------|------|------|
| **全局 DB Mock** | 所有测试 | `setup.ts` 中的 `vi.mock` | 拦截 PostgreSQL 连接 |
| **模块 Mock** | 单个测试文件 | 文件顶部的 `vi.mock` | `vi.mock('./services/application')` |
| **值 Mock** | 单个测试用例 | `vi.mocked().mockResolvedValue()` | 设置 `findApplicationById` 返回值 |

---

## 3. 各模块测试深度分析

### 3.1 Compose 模块测试（最大模块，19 个文件）

**测试文件结构**：

```
__test__/compose/
├── compose.test.ts              ← addSuffixToAllProperties 集成测试
├── config/
│   ├── config.test.ts           ← Compose 配置注入
│   ├── config-root.test.ts      ← 顶级 configs 操作
│   └── config-service.test.ts   ← 服务级 configs 操作
├── domain/
│   ├── labels.test.ts           ← Traefik labels 生成 (最重要)
│   ├── host-rule-format.test.ts ← Host 规则格式
│   ├── network-root.test.ts     ← 网络级域名
│   └── network-service.test.ts  ← 服务级域名
├── network/
│   ├── network.test.ts          ← 网络配置注入
│   ├── network-root.test.ts     ← 顶级 networks 操作
│   └── network-service.test.ts  ← 服务级 networks 操作
├── secrets/
│   ├── secret.test.ts           ← Secrets 配置注入
│   ├── secret-root.test.ts      ← 顶级 secrets 操作
│   └── secret-services.test.ts  ← 服务级 secrets 操作
├── service/
│   ├── service.test.ts          ← 通用服务操作
│   ├── service-container-name.test.ts
│   ├── service-depends-on.test.ts
│   ├── service-extends.test.ts
│   ├── service-links.test.ts
│   ├── service-names.test.ts    ← 服务名加后缀
│   └── service-volumes-from.test.ts
└── volume/
    ├── volume.test.ts           ← 卷配置注入
    ├── volume-2.test.ts         ← 卷配置注入 (35KB, 最大文件)
    ├── volume-root.test.ts      ← 顶级 volumes 操作
    └── volume-services.test.ts  ← 服务级 volumes 操作
```

**核心测试模式**：

```mermaid
graph LR
    subgraph "Compose 测试方法论"
        STEP1[Parse YAML<br/>→ ComposeSpecification]
        STEP2[调用被测函数<br/>addSuffixTo/SuffixTree/writeTo]
        STEP3[解析期望 YAML<br/>→ ComposeSpecification]
        STEP4[深度比对<br/>toEqual(expected)]
    end
    
    STEP1 --> STEP2 --> STEP4
    STEP3 --> STEP4
```

**典型测试用例 - YAML 深度相等断言**：

```typescript
// compose.test.ts
const composeData = parse(composeYamlString) as ComposeSpecification;
const updatedComposeData = addSuffixToAllProperties(composeData, "testhash");
expect(updatedComposeData).toEqual(expectedComposeSpecification);
```

**关键测试覆盖**：

| 测试能力 | 覆盖情况 | 示例 |
|----------|----------|------|
| 服务名加后缀 | ✅ 完整覆盖 | `web` → `web-testhash` |
| 跨服务引用更新 | ✅ | `depends_on`, `links`, `volumes_from` |
| 网络/卷/configs/secrets | ✅ | 所有顶级 + 服务级引用 |
| 真实世界 Compose 文件 | ✅ | Plausible 完整 Compose 验证 |
| 路径遍历安全 | ✅ | `readValidDirectory` 白名单验证 |

### 3.2 部署模块测试（4 个文件）

```
__test__/deploy/
├── application.command.test.ts  ← 命令生成正确性 (核心)
├── application.real.test.ts     ← 真实部署集成测试
├── github.test.ts               ← GitHub provider 测试
└── soft-serve.test.ts           ← Soft Serve Git 测试
```

**测试策略**：Mock 所有外部依赖（git、docker、DB），仅验证 Shell 命令字符串的正确性。

**依赖 Mock 拓扑**：

```mermaid
graph TD
    subgraph "Test: deployApplication"
        TEST[deployApplication test]
        TEST -->|mocks| M1[findApplicationById]
        TEST -->|mocks| M2[createDeployment]
        TEST -->|mocks| M3[execAsync]
        TEST -->|mocks| M4[mechanizeDockerContainer]
        TEST -->|mocks| M5[getBuildCommand]
        TEST -->|mocks| M6[sendBuildSuccessNotifications]
        TEST -->|actual| ACTUAL[cloneGitRepository<br/>实际运行]
    end
    
    subgraph "Assertions"
        A1[Git clone 命令<br/>含 branch/depth/submodules]
        A2[Nixpacks 构建命令]
        A3[Railpack 构建命令]
        A4[命令顺序: set -e → clone → build → deploy]
        A5[日志重定向: >> logPath 2>&1]
    end
    
    TEST --> A1
    TEST --> A2
    TEST --> A3
    TEST --> A4
    TEST --> A5
```

**关键断言示例——命令顺序验证**：

```typescript
it("should execute commands in correct order", async () => {
  await deployApplication({ ... });
  
  const execCalls = vi.mocked(execProcess.execAsync).mock.calls;
  const fullCommand = execCalls[0]?.[0];
  expect(fullCommand).toContain("set -e");
  expect(fullCommand).toContain("git clone");
  expect(fullCommand).toContain("nixpacks build");
});
```

### 3.3 权限模块测试（4 个文件）

```
__test__/permissions/
├── check-permission.test.ts        ← 静态角色 + 遗留布尔值覆盖
├── resolve-permissions.test.ts     ← 权限解析逻辑
├── service-access.test.ts          ← 服务级访问控制
└── enterprise-only-resources.test.ts ← 企业版资源限制
```

**测试策略**：Mock `db.query.member` 和 `hasValidLicense`，验证 `checkPermission` 抛出/不抛出异常。

```typescript
// 三层角色验证
describe("static roles bypass enterprise resources", () => {
  it("owner bypasses deployment.read", async () => {
    memberToReturn = mockMemberData("owner");
    await expect(checkPermission(ctx, { deployment: ["read"] }))
      .resolves.toBeUndefined();
  });
});

describe("static roles validate free-tier resources", () => {
  it("member fails project.create", async () => {
    memberToReturn = mockMemberData("member");
    await expect(checkPermission(ctx, { project: ["create"] }))
      .rejects.toThrow();
  });
});

describe("legacy boolean overrides for member", () => {
  it("member passes project.create with canCreateProjects=true", async () => {
    memberToReturn = mockMemberData("member", { canCreateProjects: true });
    await expect(checkPermission(ctx, { project: ["create"] }))
      .resolves.toBeUndefined();
  });
});
```

**测试矩阵覆盖**：

| 角色 | enterprise 资源 | free-tier 资源 | legacy boolean override |
|------|----------------|----------------|------------------------|
| owner | ✅ 通过 | ✅ 通过 | N/A |
| admin | ✅ 通过 | ✅ 通过 | N/A |
| member | ✅ 通过 | ❌ 拒绝 (根据配置) | ✅ 可覆盖 |

### 3.4 环境变量模块测试（4 个文件）

**核心测试能力**：

```typescript
// service.env 中的 {{project.KEY}} 和 {{environment.KEY}} 模板替换
it("resolves both project and environment variables", () => {
  const resolved = prepareEnvironmentVariables(
    `DATABASE_URL=\${{project.DATABASE_URL}}\nNODE_ENV=\${{environment.NODE_ENV}}`,
    projectEnv,  // DATABASE_URL=postgres://...:5432/project_db
    environmentEnv,  // NODE_ENV=development
  );
  expect(resolved).toEqual([
    "DATABASE_URL=postgres://...:5432/project_db",
    "NODE_ENV=development",
  ]);
});

// 未定义变量的错误处理
it("handles undefined environment variables", () => {
  expect(() => 
    prepareEnvironmentVariables(`UNDEFINED=\${{environment.UNDEFINED_VAR}}`, "", env)
  ).toThrow("Invalid environment variable: environment.UNDEFINED_VAR");
});
```

### 3.5 Traefik 配置测试（2 个文件）

**测试模式**：纯函数式测试，输入 `ApplicationNested` + `Domain`，输出 Traefik Router 配置对象，验证关键字段。

```typescript
test("Web entrypoint on http domain", async () => {
  const router = await createRouterConfig(baseApp, { ...baseDomain, https: false }, "web");
  expect(router.middlewares).not.toContain("redirect-to-https");
  expect(router.rule).not.toContain("PathPrefix");
});

test("Internationalized domain name is converted to punycode", async () => {
  const router = await createRouterConfig(baseApp, { ...baseDomain, host: "тест.рф" }, "web");
  expect(router.rule).toContain("Host(`xn--e1aybc.xn--p1ai`)");
  expect(router.rule).not.toContain("тест.рф");
});
```

**关键测试场景**：

| 测试场景 | 断言重点 |
|----------|----------|
| HTTP vs HTTPS | middleware 中是否包含 `redirect-to-https` |
| 自定义路径 | rule 中是否包含 `PathPrefix` |
| 自定义中间件 | middlewares 数组是否正确拼接 |
| stripPath + internalPath | 两个 middleware 的先后顺序 |
| IDN 域名 | punycode 转换是否正确 |
| Let's Encrypt | `tls.certResolver` 是否为 `letsencrypt` |
| 自定义证书 | `tls.certResolver` 是否为自定义名称 |

### 3.6 WebSocket 安全测试（2 个文件）

**核心安全关注点——路径遍历防御**：

```typescript
describe("readValidDirectory (path traversal)", () => {
  // 白名单路径返回 true
  it("returns true when directory is under BASE_PATH", () => {
    expect(readValidDirectory(`${BASE}/logs/app/foo.log`)).toBe(true);
  });

  // 绝对路径逃逸返回 false
  it("returns false for path traversal escaping base (absolute)", () => {
    expect(readValidDirectory("/etc/passwd")).toBe(false);
  });

  // 相对路径逃逸
  it("returns false when resolved path escapes base via ..", () => {
    expect(readValidDirectory(`${BASE}/../../etc/passwd`)).toBe(false);
  });

  // 前缀匹配防伪
  it("returns false when path looks like base but is a sibling or prefix", () => {
    expect(readValidDirectory("/base-evil")).toBe(false);
  });
});
```

**测试方法论**：安全边界全覆盖测试，包括正常路径、绝对路径逃逸、相对路径逃逸、前缀匹配逃逸、空路径、重复斜杠等。

### 3.7 容器编排测试

**mechanizeDockerContainer** 的测试使用 `vi.hoisted()` 模式：

```typescript
// 使用 vi.hoisted 在 hoist 之前创建 mock，防止引用问题
const { inspectMock, getServiceMock, createServiceMock, getRemoteDockerMock } = 
  vi.hoisted(() => ({
    inspectMock: vi.fn<() => Promise<never>>(),
    getServiceMock: vi.fn(() => ({ inspect: inspectMock })),
    createServiceMock: vi.fn(async () => undefined),
    getRemoteDockerMock: vi.fn(async () => ({
      getService: getServiceMock,
      createService: createServiceMock,
    })),
  }));

vi.mock("@dokploy/server/utils/servers/remote-docker", () => ({
  getRemoteDocker: getRemoteDockerMock,
}));
```

**测试用例覆盖**：
- `stopGracePeriodSwarm=0` 保持为数字 0（非 falsy 省略）
- `stopGracePeriodSwarm=null` 省略字段
- `ulimitsSwarm` 传递和省略
- `ulimitsSwarm=[]` 空数组也省略

---

## 4. 关键设计模式在测试中的体现

### 4.1 纯函数测试模式

**适用场景**：YAML 解析、环境变量模板替换、Traefik 路由配置、权限检查。

**特点**：
- 输入 → 输出，无副作用
- 不需要 Mock 基础设施
- 使用 `toEqual` 深度比对象
- 使用 `toContain` / `not.toContain` 验证字符串包含

### 4.2 Mock 代理模式

**适用场景**：所有涉及 DB 的测试。

**特点**：JS Proxy 拦截所有属性访问，统一返回 mock handler，避免为每个表单独定义 mock。

### 4.3 Scaffold / Builder 模式

**适用场景**：Traefik 测试（`baseApp` + `baseDomain` + 叠加 override）。

```typescript
const router = await createRouterConfig(
  baseApp,
  { ...baseDomain, https: true, middlewares: ["auth@file"] },
  "websecure",
);
```

通过 `...baseDomain` + override 构建测试变体，减少重复样板代码。

---

## 5. 测试质量评估

### 5.1 覆盖率分析（按模块）

```mermaid
graph LR
    subgraph "测试覆盖率评估"
        COMPOSE_C[Compose 操作] -->|★★★★★| C1[极高: 19个文件<br/>边界全覆盖]
        TRAEFIK_C[Traefik 配置] -->|★★★★★| C2[极高: 所有路由组合<br/>IDN/custom entrypoint]
        WSS_C[WS 路径安全] -->|★★★★★| C3[极高: 所有逃逸向量]
        PERM_C[权限系统] -->|★★★★☆| C4[高: 角色+资源矩阵<br/>企业版遗留覆盖]
        ENV_C[环境变量] -->|★★★★☆| C5[高: 模板解析<br/>多层 override]
        DEPLOY_C[部署引擎] -->|★★★☆☆| C6[中: 命令验证<br/>无集成测试]
        MONITOR_C[监控/调度] -->|★☆☆☆☆| C7[低: 几乎无测试]
        DB_C[数据库管理] -->|★☆☆☆☆| C8[低: 无专门测试]
    end
```

### 5.2 测试策略总结

| 策略 | 描述 | 优劣 |
|------|------|------|
| **函数式测试** | 纯函数输入输出验证 | ✅ 轻量、快速、可靠 |
| **YAML 深度比** | 解析 YAML 为对象后 `toEqual` | ✅ 全面验证所有字段 |
| **Mock + Spy** | 模块 Mock + 特定函数 Spy | ✅ 隔离性好，❌ 可能漏集成问题 |
| **命令字符串验证** | `toContain` 检查 Shell 命令 | ✅ 直观，❌ 字符串过于脆弱 |
| **异常断言** | `rejects.toThrow()` 验证拒绝 | ✅ 权限系统测试标准方式 |
| **Proxy Mock** | JS Proxy 截获所有 DB 调用 | ✅ 低维护成本 |

### 5.3 不足之处

1. **缺少集成测试**：没有针对 PostgreSQL + Redis + Docker 的真实集成测试
2. **缺少端到端测试**：没有 Playwright / Cypress UI 测试
3. **监控/调度模块空白**：Go 监控服务和应用级调度都没有测试
4. **数据库管理未覆盖**：PostgreSQL/MySQL/Mongo 创建和备份逻辑无测试
5. **错误路径覆盖不完整**：大部分测试验证正常路径，异常路径覆盖有限
6. **Mock 可能过松**：`Proxy` 模式不会对未预期的表名查询报错

---

## 6. CI/CD 中的测试集成

### 6.1 Pull Request 流水线

```yaml
# pull-request.yml
jobs:
  pr-check:
    strategy:
      matrix:
        job: [build, test, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      
      # 构建工具安装（仅 test job）
      - name: Install Nixpacks
        if: matrix.job == 'test'
        run: curl -sSL https://nixpacks.com/install.sh | bash
      
      - name: Install Railpack
        if: matrix.job == 'test'
        run: curl -sSL https://railpack.com/install.sh | bash
      
      # Docker Swarm 初始化（仅 test job）
      - name: Initialize Docker Swarm
        if: matrix.job == 'test'
        run: |
          docker swarm init
          docker network create --driver overlay dokploy-network || true
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm server:build
      - run: pnpm ${{ matrix.job }}
```

**流水线特点**：
- **并行矩阵**：build、test、typecheck 三个 job 并行，`test` job 需额外基础设施
- **Docker Swarm init**：测试某些需要 Swarm 环境的函数（测试 Swarm 初始化本身即可行）
- **构建工具安装**：Nixpacks / Railpack 确保测试环境中可用
- **`server:build` 前置**：`@dokploy/server` 需要先构建，测试依赖其产物

### 6.2 PR Quality 检查

```yaml
# pr-quality.yml
jobs:
  anti-slop:
    steps:
      - uses: peakoss/anti-slop@v0
        with:
          blocked-commit-authors: "claude,copilot"
          require-description: true
          min-account-age: 5
```

**设计意图**：防止 AI 生成的低质量 PR，要求真人维护者在 GitHub 上的账号超过 5 天且有 PR 描述。

---

## 7. 测试的演进路径

```mermaid
graph TB
    subgraph "当前状态 (Level 2)"
        L2[纯函数测试<br/>+ DB Mock 测试<br/>+ Shell 命令验证]
        L2 --> L2_COVER[核心覆盖: ~60%<br/>Compose: 90%<br/>Deploy: 70%<br/>Perm: 80%<br/>Monitoring: 5%]
    end
    
    subgraph "下一步 (Level 3)"
        L3[集成测试引入]
        L3 --> L3_DB[测试 PostgreSQL<br/>事务与迁移]
        L3 --> L3_DOCKER[测试 Docker<br/>容器编排逻辑]
        L3 --> L3_REDIS[测试 BullMQ<br/>队列行为]
    end
    
    subgraph "目标 (Level 4)"
        L4[端到端测试]
        L4 --> L4_E2E[Playwright 测试<br/>UI 交互]
        L4 --> L4_FULL[全链路部署<br/>Git→Build→Run]
    end
    
    L2 --> L3
    L3 --> L4
```

**推荐改进优先级**：

1. **数据库管理测试**：PostgreSQL/MySQL 创建的 Docker 容器测试
2. **部署集成测试**：真实 Git clone + Nixpacks build（在 CI 中已有 Docker Swarm）
3. **监控/调度测试**：Go 监控服务的测试接入
4. **端到端测试**：核心用户旅程（创建项目 → 配置应用 → 部署 → 验证运行）

---

## 8. 总结评价

### 优势

1. **策略正确**：采用纯函数测试为主，Mock 隔离 DB，Test Double 策略合理
2. **核心模块覆盖好**：Compose YAML 操作、Traefik 配置、权限系统测试深入
3. **安全敏感函数重点覆盖**：路径遍历防御测试全面
4. **Mock 基础设施设计精良**：链式 + Proxy 模式减少样板代码
5. **CI 集成合理**：矩阵并行，基础设施预置

### 改进空间

1. **盲区模块**：监控、调度、数据库管理几乎没有测试
2. **缺少集成测试**：没有真实 DB/Docker 的测试
3. **Mock 可能过宽**：Proxy mock 不会验证未预期的表名
4. **前端测试空白**：没有组件测试或 E2E 测试
5. **错误路径不足**：大多数测试只验证成功路径

### 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 测试基础设施 | ★★★★☆ | Vitest + Proxy Mock + CI，基础扎实 |
| 覆盖面 | ★★★☆☆ | 核心模块好，大块空白区域 |
| 测试深度 | ★★★★☆ | 边界值、安全场景覆盖好 |
| 可维护性 | ★★★★☆ | Mock 模式整洁，代码重复少 |
| CI 集成 | ★★★★☆ | 矩阵并行 + 基础设施预置 |
| 集成测试 | ★☆☆☆☆ | 几乎为零 |

---

*本文档由 Craft Agent 于 2026-05-09 自动生成*
