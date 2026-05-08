---
name: OpenSource Arch
description: 开源项目架构分析站点
colors:
  bg: "#f7f4ef"
  bg-elevated: "#fdfbf8"
  fg: "#2c2a27"
  fg-muted: "#6e6963"
  fg-faint: "#9f9890"
  accent: "#a84832"
  accent-subtle: "#e8d5cf"
  border: "#d8d3cc"
  border-strong: "#bfb9b1"
  code-bg: "#1e1c19"
  code-fg: "#d4cfc8"
typography:
  display:
    fontFamily: "Georgia, 'Noto Serif SC', serif"
    fontWeight: 700
  headline:
    fontFamily: "Georgia, 'Noto Serif SC', serif"
    fontWeight: 700
    fontSize: "1.5rem"
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, 'Noto Sans SC', sans-serif"
    fontWeight: 400
    fontSize: "1rem"
    lineHeight: 1.7
  code:
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "0.88rem"
  label:
    fontFamily: "system-ui, sans-serif"
    fontWeight: 500
    fontSize: "0.85rem"
    letterSpacing: "0.03em"
rounded:
  none: "0px"
  sm: "3px"
  md: "6px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.75rem"
  xl: "3rem"
  2xl: "5rem"
components:
  link:
    textColor: "{colors.accent}"
  link-hover:
    textColor: "{colors.fg}"
  index-item:
    borderColor: "{colors.border}"
    padding: "{spacing.md} 0"
  code-block:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-fg}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
---

# Design System: OpenSource Arch

## 1. Overview

**Creative North Star: "The Quiet Desk"**

一张干净的书桌，温暖的灯光，一本打开的书。没有多余的装饰，但也不冷清。你坐下来就能专注阅读。

这套设计系统做的事情很简单：让架构分析文章读起来舒服。不抢戏，不炫技，比纯黑白多一点温度。所有视觉决策都围绕一个目标——让读者忘记网页本身，专注于内容。

**Key Characteristics:**
- 温暖的中性色调，不是冷灰也不是纯白
- 衬线标题传递编辑质感，无衬线正文保证可读性
- 几乎没有圆角，不用阴影，用背景色差异表达层次
- 一个强调色，用得少，只在链接和关键交互处出现

## 2. Colors

微暖的中性色系，带一点点暖棕倾向。强调色是偏暖的铁锈红，不出挑但有存在感。

### Primary

- **铁锈红** (`#a84832`): 唯一的强调色。用于链接、交互高亮、关键标记。出现面积不超过任何页面的 5%。
- **铁锈红淡** (`#e8d5cf`): 铁锈红的极淡版，用于偶尔的背景高亮。

### Neutral

- **暖纸白** (`#f7f4ef`): 页面背景。比纯白暖一点，长时间阅读不刺眼。
- **亮纸白** (`#fdfbf8`): 提升层级的背景，用于需要区分的容器。
- **暖炭黑** (`#2c2a27`): 主文本色。不是纯黑，带一点棕调。
- **暖灰** (`#6e6963`): 次级文本、辅助说明。
- **浅暖灰** (`#9f9890`): 最淡的可读文本、时间戳、元数据。
- **暖边框** (`#d8d3cc`): 分割线、列表分隔。
- **深暖边框** (`#bfb9b1`): 需要更强存在感的分隔。

### 代码色

- **暗底** (`#1e1c19`): 代码块背景。深暖黑，不是冷灰。
- **亮字** (`#d4cfc8`): 代码块文字。暖白，与暗底配对比度足够。

**The One Accent Rule.** 全站只有一个强调色。不搞多色分类、不按项目变色。铁锈红就是铁锈红，始终如一。

## 3. Typography

**Display Font:** Georgia + Noto Serif SC（衬线，标题用）
**Body Font:** system-ui + Noto Sans SC（无衬线，正文用）
**Code Font:** SF Mono / Fira Code / Consolas（等宽）

**Character:** 衬线标题给编辑感，无衬线正文给可读性。中文优先用 Noto 系列保证显示一致。不追求字体个性，追求阅读舒适。

### Hierarchy

- **Display** (700, clamp(1.6rem, 3.5vw, 2.4rem), 1.15): 页面主标题。只出现一次。
- **Headline** (700, 1.5rem, 1.25): 文章内 h2。章节标题。
- **Title** (600, 1.15rem, 1.3): 文章内 h3。子章节。
- **Body** (400, 1rem, 1.7): 正文段落。行宽限制 65-75ch。行高偏松，长文不累。
- **Label** (500, 0.85rem, letter-spacing 0.03em): 表格表头、元数据、小字标签。可大写。

**The No-Flat-Scale Rule.** 标题层级之间必须有明显的尺寸和字重差异。不允许两个相邻层级看起来差不多。

## 4. Elevation

不用阴影。通过背景色差异和边框表达层次。

- **页面层级**: 背景色从 `#f7f4ef` 到 `#fdfbf8`，微妙的色差区分区域。
- **代码块**: 深色背景 (`#1e1c19`) 自带提升感，不需要额外阴影。
- **悬停状态**: 通过颜色变化（文字变强调色）而非阴影来反馈。

**The No-Shadow Rule.** 整个站点零阴影。如果你发现自己在写 `box-shadow`，停下来，用背景色或边框替代。

## 5. Components

### Navigation

- 纯文本导航。无背景色、无圆角胶囊、无高亮条。
- 链接默认 `#6e6963`，悬停 `#a84832`。
- 移动端折叠为简单列表。

### Article Body

- 行宽 `680px` 居中。这是最重要的单一数值。
- 段落间距 `1rem`，章节间距 `5rem`。拉开节奏。
- 图片 `max-width: 100%`，圆角 `3px`。

### Code Blocks

- 背景 `#1e1c19`，文字 `#d4cfc8`，圆角 `6px`，内边距 `1.75rem`。
- 行内代码：背景 `#d8d3cc`，内边距 `0.15em 0.4em`，圆角 `3px`。
- 不做语法高亮主题，保持单色。

### Tables

- 无背景色条纹。只有底部边框 (`#d8d3cc`)。
- 表头字重 600，字号 `0.85rem`，可大写。
- 单元格内边距 `0.5rem 1rem`。

### Index List

- 列表项之间用底部分割线分隔。
- 标题（衬线，600，`1.15rem`）+ 右侧元数据（`0.85rem`，`#9f9890`）。
- 可选描述行：`0.92rem`，`#6e6963`，最大 `55ch`。

### Links

- 默认 `#a84832`，下划线 `1px`，`underline-offset 2px`。
- 悬停：下划线 `2px`。
- 焦点：`2px` 实线轮廓 `#a84832`，偏移 `3px`。

## 6. Do's and Don'ts

### Do:

- **Do** 用暖中性色（`#f7f4ef`, `#2c2a27`）而非纯黑白（`#fff`, `#000`）。
- **Do** 限制行宽在 65-75ch 以内。长行读起来累。
- **Do** 保持间距有节奏：章节间大（`5rem`），段落间中（`1rem`），列表项间小（`0.25rem`）。
- **Do** 用背景色差异而非阴影来表达层次。
- **Do** 保证正文与背景对比度 ≥ 4.5:1。

### Don't:

- **Don't** 用渐变。任何地方。背景、文字、按钮都不行。
- **Don't** 加动画。没有滚动动画、入场动画、悬停位移。状态切换用 `0.2s` 以内的颜色过渡就够。
- **Don't** 用圆角超过 `6px`。这不是一个友好的圆泡泡产品，是一个技术阅读站点。
- **Don't** 用 `border-left` 超过 1px 作为彩色条纹。引用块用细线就够了。
- **Don't** 加广告、侧边栏推荐、弹窗订阅。CSDN 式的信息噪音是被明确禁止的。
- **Don't** 搞 hero 区域的大数字和 CTA 按钮。这不是 SaaS 营销页。
- **Don't** 用多色系统。一个铁锈红强调色，足够了。
