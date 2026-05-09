# 项目规划 & 路线图

## 愿景

成为中文社区中最系统、最深入的开源项目架构分析集合。每个分析力求做到：

- **看得懂**：面向有 1-3 年经验的开发者
- **有深度**：不止于表面，剖析核心设计决策
- **可追溯**：标注源码位置、版本号，方便对照阅读
- **可视化**：用架构图、时序图辅助理解

## 分析文档结构

每个分析遵循统一模板，包含以下章节：

1. **项目概览** — 官方介绍、版本、Star 数、核心贡献者
2. **技术栈** — 编程语言、构建系统、依赖管理
3. **整体架构** — 高层架构图、模块划分
4. **核心模块详解** — 每个关键模块的设计与实现
5. **关键设计决策** — 为什么这样设计
6. **数据流 / 请求流** — 一次完整操作的链路
7. **设计模式** — 使用的设计模式及示例代码位置
8. **工程实践** — 测试、部署、版本管理
9. **总结与评价** — 亮点与可改进之处

## 已完成分析

| # | 项目 | 领域 | 完成日期 | 分析文档 |
|---|------|------|----------|----------|
| 1 | **Miniflux** | RSS 阅读器 | 2026-05-08 | [analyses/miniflux/](./analyses/miniflux/) |
| 2 | **New-API** | AI API 网关 | 2026-05-08 | [analyses/new-api/](./analyses/new-api/) |
| 3 | **RSSHub** | RSS 聚合器 | 2026-05-08 | [analyses/rsshub/](./analyses/rsshub/) |
| 4 | **nanoGPT** | GPT 训练框架 | 2026-05-09 | [analyses/nanogpt/](./analyses/nanogpt/) |
| 5 | **LobeChat** | AI Agent 框架 | 2026-05-09 | [analyses/lobehub/](./analyses/lobehub/) · [状态管理层](./analyses/lobehub/state-management.md) |
| 6 | **Coolify** | 自托管 PaaS | 2026-05-09 | [analyses/coolify/](./analyses/coolify/) |
| 7 | **Dokploy** | 自托管 PaaS | 2026-05-09 | [analyses/dokploy/](./analyses/dokploy/) |
| 8 | **pi-mono** | AI Agent 框架 | 2026-05-09 | [analyses/pi-mono/](./analyses/pi-mono/) |
| 9 | **Gitea** | Git 服务 | 2026-05-09 | [analyses/gitea/](./analyses/gitea/) |
| 10 | **Nitter** | Twitter 替代前端 | 2026-05-09 | [analyses/nitter/](./analyses/nitter/) |
| 11 | **Redlib** | Reddit 替代前端 | 2026-05-09 | [analyses/redlib/](./analyses/redlib/) |

## 改进任务跟踪

各项目分析中发现的改进点见 [TASKS.md](./TASKS.md)，共 **52 项**（高优先级 10 项，中优先级 28 项，低优先级 14 项）。

## 待分析项目

| 项目 | 领域 | 状态 |
|------|------|------|
| Redis | 缓存/数据库 | 📝 待分析 |
| Nginx | Web 服务器 | 📝 待分析 |
| Linux Kernel | OS | 📝 待分析 |
| Kubernetes | 容器编排 | 📝 待分析 |

## 工具链

- **流程图**: Mermaid / PlantUML
- **截图标注**: 配合源码截图 + 标注
- **版本管理**: 对照分析的 Git tag / release 版本
