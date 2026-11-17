import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { buildSite, entry, pngFixture, readTextArtifacts, tmpDir } from "./helpers/build"
import { plainText } from "./helpers/html"

/**
 * 行内语法与条目展示面（ticket 07）。
 *
 * 接缝与 ticket 01–06 相同：fixture 花园库真构建一次，只读产物断言
 * "有没有这段内容 / 这个状态"。
 *
 * 口径（spec.md "Testing Decisions"：不断言 HTML 结构、不断言插件内部函数名）：
 * 优先用 HTML 自身的语义——<mark> 表示高亮、<sup> 表示脚注编号、<img width>
 * 表示限宽、<blockquote> 表示引述、<details>+<table> 表示可折叠的键值面板、
 * <h2>–<h4> 表示标题层级。只有在 HTML 没有对应元素时（callout 的语义类型与
 * 折叠状态、样式里的语义色）才退一步：仍然只认产出的"特性词"（callout、
 * collaps），不写死 class 名、属性名、CSS 变量名——插件改名不影响判定，
 * 关掉特性则会立刻变红。
 */

const fixtureRoot = path.join(tmpDir, "inline-syntax")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const fence = "```"

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string | Buffer> = {
    "语法.md": entry(
      `publish: true
title: 语法
description: 行内语法都该原样搬到站点上。
date: 2026-11-16`,
      `高亮：==这段要高亮==

行内脚注：这里有个说法^[脚注正文在页面底部] 后面继续。

尺寸图片：![示意图|300](attachments/图.png)

原尺寸图片：![原图](attachments/图.png)

> [!note] 提示标题
> 蓝色语义正文。

> [!tip] 技巧标题
> 青色语义正文。

> [!warning] 当心标题
> 橙色语义正文。

> [!danger] 危险标题
> 红色语义正文。

> [!note]- 折叠的笔记
> 默认收起的正文。

- [ ] 未完成任务
- [x] 已完成任务

| 列一 | 列二 |
| --- | --- |
| 甲 | 乙 |

${fence}ts
const answer = 42
${fence}

## 二级标题

### 三级标题

#### 四级标题
`,
    ),
    "嵌入语法.md": entry(
      `publish: true
title: 嵌入语法
description: 整篇嵌入含 callout 与任务列表的条目。
date: 2026-11-16`,
      "![[语法]]\n",
    ),
    "属性面板.md": entry(
      `publish: true
title: 属性面板
description: 面板只该显示这一段描述。
date: 2026-11-16
draft: false
unlisted: false
内部字段: 内部值不该出现在页面上`,
      "正文。",
    ),
    "attachments/图.png": pngFixture,
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content)
  }
}

/** 产物里的一段元素：开标签 + 到对应闭标签为止的内容。 */
interface Chunk {
  openTag: string
  html: string
}

const chunks = (html: string, tag: string): Chunk[] => {
  const out: Chunk[] = []
  const open = new RegExp(`<${tag}\\b[^>]*>`, "gi")
  let match: RegExpExecArray | null
  while ((match = open.exec(html)) !== null) {
    const start = match.index ?? 0
    const end = html.indexOf(`</${tag}>`, open.lastIndex)
    out.push({ openTag: match[0], html: html.slice(start, end === -1 ? undefined : end) })
  }
  return out
}

/** 含某段文字的引述块——callout 在产物里就是一段引述。 */
const quote = (html: string, text: string) =>
  chunks(html, "blockquote").find((chunk) => plainText(chunk.html).includes(text))

/** 产物里点名的语义类型：开标签里出现该类型词（属性名/class 名都不追究）。 */
const named = (openTag: string, kind: string) => new RegExp(`\\b${kind}\\b`, "i").test(openTag)

const COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi
const KINDS = ["note", "tip", "warning", "danger"] as const

/**
 * 样式里每种语义类型的颜色值（第一个是主色）。
 * 只认"规则选择器里带 callout 特性词、且点名了类型"这种形状；没有点名类型的
 * callout 规则（全类型兜底色，也就是 note 的底色）作为兜底。
 */
const semanticColors = (css: string): Map<string, string[]> => {
  const own = new Map<string, string[]>()
  const shared: string[] = []
  for (const rule of css.split("}")) {
    const brace = rule.lastIndexOf("{")
    if (brace === -1) continue
    const selector = rule.slice(0, brace)
    if (!/callout/i.test(selector)) continue
    const colors = rule.slice(brace).match(COLOR) ?? []
    let derived = false
    for (const kind of KINDS) {
      if (named(selector, kind)) {
        own.set(kind, [...(own.get(kind) ?? []), ...colors])
        derived = true
      }
    }
    if (!derived) shared.push(...colors)
  }
  for (const kind of KINDS) if (!own.has(kind)) own.set(kind, shared)
  return own
}

describe("行内语法与条目展示面", () => {
  let artifacts: Map<string, string>

  const page = (name: string) => {
    const html = artifacts.get(name)
    assert.ok(html, `缺产物页：${name}`)
    return html!
  }

  const scripts = () =>
    [...artifacts.entries()]
      .filter(([artifact]) => artifact.endsWith(".js"))
      .map(([, text]) => text)
      .join("\n")

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    artifacts = await readTextArtifacts(outDir)
  })

  test("==高亮== 渲染成高亮，标记本身不进产物", () => {
    const html = page("语法.html")
    assert.ok(!html.includes("==这段要高亮=="), "高亮标记原样漏进了产物")

    // <mark> 是 HTML 里表示"被标出/高亮"的标准元素，不追究 class 叫什么。
    const marked = chunks(html, "mark").map((chunk) => plainText(chunk.html))
    assert.ok(
      marked.some((text) => text.includes("这段要高亮")),
      `高亮文字没有落进 <mark>：${marked.join(" | ")}`,
    )
  })

  test("^[行内脚注] 折叠成脚注：句子里只留编号，注文落在句后且可来回跳", () => {
    const html = page("语法.html")
    const note = "脚注正文在页面底部"
    assert.ok(!html.includes("^["), "行内脚注标记原样漏进了产物")

    const sentenceStart = html.indexOf("这里有个说法")
    assert.ok(sentenceStart >= 0, "产物里找不到脚注所在的句子")
    const sentence = html.slice(sentenceStart, html.indexOf("后面继续", sentenceStart))

    // <sup> 是 HTML 表示"上标编号"的标准元素；它里面的链接指向脚注本体。
    const ref = /<sup\b[^>]*>[\s\S]*?(<a\b[^>]*>)/i.exec(sentence)
    assert.ok(ref, "句子里的脚注标记没有渲染成上标引用")
    assert.ok(!plainText(sentence).includes(note), "脚注正文仍留在句子里，没有被折到页尾")

    const href = /\bhref="#([^"]+)"/.exec(ref![1])?.[1]
    assert.ok(href, `脚注引用没有指向注文的链接：${ref![1]}`)
    const anchor = decodeURI(href!)
    const targetAt = html.indexOf(`id="${anchor}"`)
    assert.ok(targetAt > sentenceStart + sentence.length, "脚注锚点没有落在句子之后")
    const landed = plainText(html.slice(targetAt, targetAt + 600))
    assert.ok(landed.includes(note), `脚注锚点处没有注文：${landed.slice(0, 120)}`)

    // 回跳：注文那一处要有链接指回句子里的引用，否则读者回不去。
    const refId = /\bid="([^"]+)"/.exec(ref![1])?.[1]
    assert.ok(refId, "脚注引用没有可回跳的锚点")
    assert.ok(
      html.slice(targetAt, targetAt + 600).includes(`href="#${refId}"`),
      "脚注本体没有回到引用的链接",
    )
  })

  test("![图|300](x.png) 的尺寸标记生效：宽度受限而非原图尺寸", () => {
    const html = page("语法.html")
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
    const sized = images.find((tag) => /\balt="示意图"/.test(tag))
    assert.ok(sized, "尺寸标记的图片没有产出 <img>")
    assert.match(sized!, /\bwidth\s*=\s*["']?300["']?/, `图片没有按 300 限宽：${sized}`)

    // 负对照：同一张图不带尺寸标记时不该被写上宽高，否则上面的断言只是恒真。
    const natural = images.find((tag) => /\balt="原图"/.test(tag))
    assert.ok(natural, "没带尺寸标记的图片没有产出 <img>")
    assert.ok(
      !/\b(width|height)\s*=/.test(natural!),
      `没带尺寸标记的图片也被写死了尺寸：${natural}`,
    )
  })

  test("callout 的四种语义类型各自成立，且在样式里有各自的颜色", () => {
    const html = page("语法.html")
    const bodies: Record<(typeof KINDS)[number], string> = {
      note: "蓝色语义正文",
      tip: "青色语义正文",
      warning: "橙色语义正文",
      danger: "红色语义正文",
    }
    for (const kind of KINDS) {
      const block = quote(html, bodies[kind])
      assert.ok(block, `${kind} callout 的正文没有渲染成引述块`)
      assert.ok(named(block!.openTag, kind), `引述块没有把 ${kind} 语义标出来：${block!.openTag}`)
    }
    assert.ok(!html.includes("[!note]"), "callout 语法原样漏进了产物")

    const css = [...artifacts.entries()]
      .filter(([artifact]) => artifact.endsWith(".css"))
      .map(([, text]) => text)
      .join("\n")
    const colors = semanticColors(css)
    const primary = KINDS.map((kind) => colors.get(kind)?.[0])
    for (const [index, kind] of KINDS.entries()) {
      assert.ok(primary[index], `样式里没有 ${kind} 的语义色`)
    }
    assert.equal(new Set(primary).size, 4, `四种语义色没有区分开：${primary.join(",")}`)
  })

  test("[!note]- 默认折叠（内容仍在）且页面带展开机制", () => {
    const html = page("语法.html")
    const folded = quote(html, "折叠的笔记")
    assert.ok(folded, "折叠 callout 没有渲染出来")
    const tokens = folded!.openTag.match(/collaps\w*/gi) ?? []
    assert.ok(tokens.length > 0, `折叠 callout 没有折叠状态标记：${folded!.openTag}`)
    assert.ok(
      plainText(folded!.html).includes("默认收起的正文"),
      "折叠把正文丢掉了，展开后没内容可看",
    )

    const open = quote(html, "提示标题")
    assert.ok(open, "普通 callout 没有渲染出来")
    assert.ok(!/collaps/i.test(open!.openTag), `普通 callout 被误标成可折叠：${open!.openTag}`)

    // 可展开：页面脚本认得出同一个折叠标记（改实现可以，标记与状态脱节不行）。
    const js = scripts()
    assert.ok(
      tokens.some((token) => js.includes(token)),
      `折叠状态 ${tokens.join(",")} 没有任何脚本处理，读者点不开`,
    )
  })

  test("任务列表（勾选/未勾选）、表格、代码块、多级标题原样生效", () => {
    const html = page("语法.html")
    const boxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/gi)].map(
      (match) => match[0],
    )
    assert.equal(boxes.length, 2, `任务列表复选框数量不对：${boxes.length}`)
    assert.ok(
      boxes.some((tag) => /\bchecked\b/.test(tag)),
      "已勾选任务没有保留勾选态",
    )
    assert.ok(
      boxes.some((tag) => !/\bchecked\b/.test(tag)),
      "未勾选任务被误勾选",
    )
    for (const text of ["未完成任务", "已完成任务"]) {
      assert.ok(html.includes(text), `任务列表缺文字：${text}`)
    }
    assert.ok(!/[-*]\s*\[[ x]\]/.test(html), "任务列表仍是原始 Markdown 文本")

    assert.match(html, /<table[\s>]/i, "表格没有渲染成表格")
    for (const text of ["列一", "列二", "甲", "乙"]) {
      assert.ok(html.includes(text), `表格缺单元格文字：${text}`)
    }
    assert.ok(!/\|\s*列一\s*\|/.test(html), "表格仍是原始 Markdown 文本")

    assert.match(html, /<pre[\s>]/i, "代码块没有渲染成 <pre>")
    assert.ok(plainText(html).includes("const answer = 42"), "代码块内容丢失")
    assert.ok(!html.includes(fence), "代码块围栏原样漏进了产物")

    // 多级标题：层级与顺序都在（不追究 id 生成规则）。
    const headings = [...html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
      level: Number(match[1]),
      at: match.index ?? 0,
      text: plainText(match[2]),
    }))
    let previous = -1
    for (const [level, name] of [
      [2, "二级标题"],
      [3, "三级标题"],
      [4, "四级标题"],
    ] as const) {
      const heading = headings.find((candidate) => candidate.text === name)
      assert.ok(heading, `没有渲染出正文标题：${name}`)
      assert.equal(heading!.level, level, `${name} 的层级不对`)
      assert.ok(heading!.at > previous, `${name} 的位置不在前一级标题之后`)
      previous = heading!.at
    }
  })

  test("属性面板只露出 description，内部字段不上页面", () => {
    const html = page("属性面板.html")
    const description = "面板只该显示这一段描述。"

    // 面板就是"可折叠的键值表"：<details> 里一张只有一行的表。
    // 找不到面板本身就说明面板没渲染——这条断言替代了旧的空转正对照。
    const panel = chunks(html, "details").find((chunk) =>
      plainText(chunk.html).includes("description"),
    )
    assert.ok(panel, "页面里没有渲染出包含 description 的属性面板")

    const rows = [...panel!.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    assert.equal(rows.length, 1, `属性面板只该有 description 一行，实际 ${rows.length} 行`)

    const cells = [...rows[0][1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      plainText(cell[1]),
    )
    assert.deepEqual(
      cells,
      ["description", description],
      `面板这一行不是 description：${cells.join(" | ")}`,
    )

    for (const leak of ["publish", "unlisted", "draft", "内部字段", "内部值不该出现在页面上"]) {
      assert.ok(!html.includes(leak), `内部字段漏到了页面上：${leak}`)
    }
  })

  test("嵌入页里的 callout 与任务列表仍然可用", () => {
    const html = page("嵌入语法.html")
    for (const text of ["蓝色语义正文", "青色语义正文", "橙色语义正文", "红色语义正文"]) {
      assert.ok(quote(html, text), `嵌入页缺 callout：${text}`)
    }
    const folded = quote(html, "折叠的笔记")
    assert.ok(folded, "嵌入页里的折叠 callout 没有渲染出来")
    assert.match(folded!.openTag, /collaps/i, `嵌入页丢了折叠状态：${folded!.openTag}`)

    const boxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/gi)]
    assert.equal(boxes.length, 2, `嵌入页任务列表复选框数量不对：${boxes.length}`)
    assert.ok(plainText(html).includes("已完成任务"), "嵌入页任务列表缺文字")

    assert.ok(!html.includes("![[语法]]"), "整篇嵌入仍是原始 wikilink 文本")
  })
})
