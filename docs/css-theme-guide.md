# CSS 主题样式开发指南

本项目支持亮色 / 暗色 / 跟随系统三种主题模式。本文档说明开发时如何正确使用颜色，确保新组件在两种主题下都能正常显示。

## 工作原理

```
src/ui/index.css 中定义了三层结构：

:root { --surface: #FFFFFF; ... }                          ← 亮色默认值
@media (prefers-color-scheme: dark) { :root { --surface: #1A1915; ... } }  ← 暗色覆盖值
@theme inline { --color-surface: var(--surface); ... }     ← Tailwind 工具类映射
```

Electron 主进程通过 `nativeTheme.themeSource` 控制系统配色偏好，Chromium 自动更新 `prefers-color-scheme` 媒体查询，CSS 变量随之切换，无需 JS 干预。

## 颜色使用规则

**一句话原则：不要硬编码颜色，使用语义化的 Tailwind 工具类。**

### 不要这样写

| 写法 | 问题 | 应改为 |
|------|------|--------|
| `bg-white` / `bg-[#FFFFFF]` | 暗色模式下仍是白色 | `bg-surface` |
| `bg-[#FAF9F6]` | 硬编码色值 | `bg-surface-cream` |
| `bg-gray-50` / `bg-gray-100` | Tailwind 原生灰色不跟随主题 | `bg-surface-secondary` |
| `bg-blue-50 text-blue-900` | 蓝色系硬编码 | `bg-info-light text-ink-900` |
| `text-black` / `text-gray-900` | 暗色模式下不可读 | `text-ink-900` |
| `text-gray-500` | 不跟随主题 | `text-muted` |
| `border-gray-200` | 不跟随主题 | `border-ink-900/10` |
| `style={{ color: '#333' }}` | 内联硬编码 | 用 Tailwind 语义类 |

### 可用的语义化颜色

#### 背景

| 工具类 | 用途 | 亮色 | 暗色 |
|--------|------|------|------|
| `bg-surface` | 主背景（卡片、弹窗、下拉菜单） | `#FFFFFF` | `#1A1915` |
| `bg-surface-cream` | 侧边栏等温暖背景 | `#FAF9F6` | `#1F1E1A` |
| `bg-surface-secondary` | 次级区域 | `#F5F4F1` | `#242320` |
| `bg-surface-tertiary` | 三级背景、hover 底色 | `#EFEEE9` | `#2D2C28` |

#### 文字

| 工具类 | 用途 |
|--------|------|
| `text-ink-900` | 标题、主要文字 |
| `text-ink-800` | 正文（强） |
| `text-ink-700` | 正文（普通） |
| `text-ink-600` / `text-ink-500` | 次要说明 |
| `text-muted` | 最弱辅助文字 |

#### 功能色

| 工具类 | 用途 |
|--------|------|
| `bg-accent` / `text-accent` | 强调色（橙色） |
| `bg-accent-subtle` | 选中态轻底色 |
| `bg-info-light` | 说明信息框背景 |
| `bg-success-light` | 成功信息框背景 |
| `bg-error-light` | 错误信息框背景 |
| `bg-warning-light` | 警告信息框背景 |

#### Tooltip

| 工具类 | 说明 |
|--------|------|
| `bg-tooltip-bg text-tooltip-fg` | 始终深底浅字，暗色模式下不会反转 |

> 注意：不要用 `bg-ink-900 text-white` 做 Tooltip，因为 `ink-900` 在暗色下是浅色。

#### 边框和分隔

推荐使用 `ink-900` 的透明度变体，自动适配两种模式：

```
border-ink-900/10    轻边框
border-ink-900/5     最轻边框
bg-ink-900/5         hover 高亮
bg-ink-900/40        遮罩层
```

#### 阴影

```
shadow-soft       轻阴影（暗色自动加深）
shadow-card       卡片阴影
shadow-elevated   弹窗阴影
```

## 新增颜色

如果现有变量不能满足需求，按以下步骤在 `src/ui/index.css` 中新增：

1. `:root { }` — 添加亮色值 `--my-color: #xxx;`
2. `@media (prefers-color-scheme: dark) { :root { } }` — 添加暗色值 `--my-color: #yyy;`
3. `@theme inline { }` — 映射为 Tailwind 类 `--color-my-color: var(--my-color);`
4. 组件中使用 `bg-my-color` / `text-my-color`

## 开发自查

写完新组件后，在 **设置 → 显示设置 → 外观主题** 切换到暗色模式，检查：

- 没有突兀的白色或纯黑色块
- 文字对比度足够，可以清晰阅读
- 弹窗、下拉菜单、Tooltip 背景跟随主题
- 边框和分隔线在暗色下仍可见但不刺眼
