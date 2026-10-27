# 讲义制作规范

本站用 VitePress 构建。每一讲 = 一个 Markdown 文件 + 一个原图文件夹 + 若干本讲专用的交互组件。范本是 `lectures/00-01.md`，写之前请通读一遍。

## 目录约定

| 内容 | 位置 |
|---|---|
| 正文 | `lectures/<编号>.md`，如 `lectures/02.md` |
| 原图 | `public/img/<编号>/`，文件名 `p<三位页码>[abcd].jpg/png/webp`，正文引用为 `/img/<编号>/p012.jpg` |
| 本讲交互组件 | `.vitepress/theme/components/L<编号><名字>.vue`，如 `L02OtpDemo.vue`（必须放在 components 根目录，会被自动全局注册） |
| 本讲工具函数 | `.vitepress/theme/lib/l<编号>.ts` |

**不要修改共享文件**：`config.mts`、`custom.css`、`index.ts`、`Layout.vue`、`lib/crypto.ts`、`lib/store.ts`、`index.md`，以及 components 下不带 `L<编号>` 前缀的组件，还有别的讲的文件。侧栏、首页和上一讲/下一讲链接由统稿人统一更新。可以 import 使用 `lib/crypto.ts` 里的函数；如果需要新的通用函数，写进自己的 `lib/l<编号>.ts`。

## 内容要求

1. **全中文**，术语首次出现时附英文（`<span class="en">Ciphertext-only</span>`）。
2. **原图全部搬过来**：课件中每一张位图都要出现（同一张图在逐步展开的多页里重复出现时只放一次）。用 PyMuPDF 提取，带透明通道的图要合并 smask；最长边超过 1600px 的缩小；有透明通道的存 `.webp`，其余存 `.jpg`（quality 86）。同一页有多张图时加 a/b/c/d 后缀。
3. **矢量图**（课件里用 TikZ 等画的图表、流程图、游戏示意图，提取不到位图）：用 SVG 或交互组件重画，或按页截图后裁剪成图片（`page.get_pixmap(dpi=200, clip=rect)`），二选一，不能漏。
4. **不遗漏内容**：每个定义、定理、证明、例子、Q/A、脚注都要有。课件里逐步展开的重复页合并成一段。重复的知识点可以适当压缩。
5. **页码标签**：每个小节、定义框、图都标原课件 PDF 页码（PDF 的物理页码，从 1 开始，不是幻灯片角标）。
6. 课件的 Q/A（先问后答）做成 `::: qa`。
7. 自己补充的解释要标“补充说明”。发现课件有错或不严谨的地方，保留原文并用灰字注释，不要直接改。
8. 每节末尾加 `::: tldr` 一句话总结，全讲最后放“★ 本讲速记”（`:::: recap`）和参考文献。
9. 证明要写完整的推导步骤，每一步说明依据。
10. 正文不要引用读者看不到的文件（本地笔记、作业、未公开的资料等）。

## Markdown 语法

```md
<div class="lec-kicker">CRYPTOGRAPHY · LECTURE 02</div>

# 完美保密

<p class="lead">一段导语。</p>

<Chips :items="['来源：2025FallCryptoCourse02.pdf（97 页）', 'N 个交互演示', '阅读约 X 分钟']" />

<div class="ctrl"><RevealAll /><span class="muted" style="font-size:13px">图例：<span class="src">P12</span> 为原课件 PDF 页码 · Q 卡片先想再看 · 点击图片可放大</span></div>

<div class="part-label">PART 1 · 标题</div>

## 2.1 小节标题

::: def 定义名 @P12–13          （def / prin / ex / warn / exam 五种框）
内容，可以有 $公式$ 和列表
:::

::: ex [自定义标签] 标题 @P20
:::

::: qa 问题文字 @P30–31
答案
:::

::: tldr
一句话总结
:::

:::: recap
::: card 卡片标题
- 要点
:::
::::

行内页码：<Src p="18–19" />
图片：<Fig src="/img/02/p010.jpg" cap="说明" p="10" />      size="sm" / "md" 可选
并排：
<FigGrid>
<Fig ... />
<Fig ... />
</FigGrid>
交互组件：<L02OtpDemo />（单独一行，前后空行）
```

注意事项：
- 正文中不要出现 `{{`（会被 Vue 当作插值）。
- 小节标题用 `## 2.1 …`、`### 2.1.1 …` 编号，编号前缀用本讲的讲号。
- 公式用 `$…$` 和 `$$…$$`（构建时由 MathJax 渲染）。

## 交互组件规范

- 用 `<Widget title="标题">` 包裹，内部用全局样式类：`.ctrl`、`.btn`、`.btn.primary`、`.seg`（按钮组，选中项加 `.on`）、`.out`（输出框，可加 `.prose`）、`.stats` / `.stat`、`.cell`、`.mini-table`、`.widget-note`。
- 颜色一律用 CSS 变量（这样才能跟随深色模式）：`var(--accent)`、`var(--accent-soft)`、`var(--ink)`、`var(--ink-2)`、`var(--ink-3)`、`var(--line)`、`var(--line-2)`、`var(--paper)`、`var(--vp-c-bg)`、`var(--ex)`、`var(--warn)`、`var(--prin)`，以及对应的 `-bg`。SVG 里要写成 `style="fill:var(--accent)"`，不能用 `fill="var(...)"`。
- 不要在 setup 顶层访问 `window` / `document`（构建时会做服务端渲染），需要时放进 `onMounted`。
- 组件应当真正帮助理解：演示一个过程、让读者动手改参数看结果、或者玩一个安全游戏。每讲 3–8 个，宁缺毋滥。
- 范例：`CommDemo.vue`（动画）、`ShiftWheel.vue`（参数 + 结果）、`IjAttack.vue`（图表）、`ThreatModel.vue`（SVG 示意）。

## 自检

完成后在 `site/` 下运行：

```bash
npx vitepress build
```

必须构建通过、无报错。再用 grep 确认：正文没有残留的 `:::` 语法错误；引用的每张图都在 `public/img/<编号>/` 下存在；提取出的每张图都在正文里被引用。
