import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  buildSite,
  entry,
  listArtifacts,
  pngFixture,
  readTextArtifacts,
  tmpDir,
} from "./helpers/build"

/**
 * 行内语法与条目展示面（ticket 07）。
 *
 * 接缝与 ticket 01–06 相同：fixture 花园库真构建一次，只读产物断言
 * "有没有这段内容 / 这个状态"。不锁 HTML 结构与插件内部函数——
 * Quartz 5 把 frontmatter/links/drafts 收进内建后，上游小版本会改内部形状。
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
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

/** 产物页的可见文本：去标签、合并空白。 */
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

/** 紧贴在某段文字之前的那个元素开标签——用它判断"这段文字被包成了什么"。 */
const wrappingTag = (html: string, text: string) => {
  const at = html.indexOf(text)
  assert.ok(at >= 0, `产物里找不到这段文字：${text}`)
  const found = html.slice(0, at).match(/<([a-z][a-z0-9]*)\b([^>]*)>\s*$/i)
  return found ? { tag: found[1].toLowerCase(), attrs: found[2] } : undefined
}

interface Callout {
  /** 语义类型（note/tip/warning/danger…），来自产物里给样式用的类型标记。 */
  kind: string
  html: string
  collapsed: boolean
  collapsible: boolean
}

/** 产物里的 callout：按开标签切段，读出语义类型与折叠状态。 */
const callouts = (html: string): Callout[] => {
  const out: Callout[] = []
  const open = /<blockquote\b([^>]*\bclass="[^"]*\bcallout\b[^"]*"[^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = open.exec(html)) !== null) {
    const attrs = match[1]
    const classes = (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/).filter(Boolean)
    const state = ["callout", "is-collapsible", "is-collapsed"]
    const kind =
      /\bdata-callout="([^"]*)"/.exec(attrs)?.[1] ??
      classes.find((cls) => !state.includes(cls)) ??
      ""
    const start = match.index ?? 0
    const end = html.indexOf("</blockquote>", open.lastIndex)
    out.push({
      kind,
      html: html.slice(start, end === -1 ? undefined : end),
      collapsed: classes.includes("is-collapsed"),
      collapsible: classes.includes("is-collapsible"),
    })
  }
  return out
}

/**
 * 样式产物里每种 callout 语义类型的 --color（去引号后的字面值）。
 * 裸 `[data-callout]` 是全类型的兜底色，也就是 note 自己的底色（note 不另写规则）。
 */
const calloutColors = (css: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const rule of css.split("}")) {
    const brace = rule.lastIndexOf("{")
    if (brace === -1) continue
    const color = /--color\s*:\s*([^;}]+)/i.exec(rule.slice(brace))?.[1]?.trim()
    if (!color) continue
    // 选择器可能是逗号分组（failure、danger、bug 共用一条规则），逐个登记。
    for (const selector of rule
      .slice(0, brace)
      .matchAll(/\[data-callout(?:=["']?([a-z-]+)["']?)?\]/gi)) {
      map.set((selector[1] ?? "").toLowerCase(), color)
    }
  }
  return map
}

describe("行内语法与条目展示面", () => {
  let files: string[]
  let artifacts: Map<string, string>

  const page = (name: string) => {
    const html = artifacts.get(name)
    assert.ok(html, `缺产物页：${name}`)
    return html!
  }

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
  })

  test("==高亮== 渲染成高亮，标记本身不进产物", () => {
    const html = page("语法.html")
    assert.ok(!html.includes("==这段要高亮=="), "高亮标记原样漏进了产物")
    const wrap = wrappingTag(html, "这段要高亮")
    assert.ok(wrap, "高亮文字没有被任何元素包住")
    const highlighted = wrap!.tag === "mark" || /highligh/i.test(wrap!.attrs)
    assert.ok(highlighted, `高亮文字没有高亮语义：<${wrap!.tag} ${wrap!.attrs}>`)
  })

  test("^[行内脚注] 折叠成脚注：正文句子不展开，注文在页尾且可跳转", () => {
    const html = page("语法.html")
    const note = "脚注正文在页面底部"
    assert.ok(!html.includes("^["), "行内脚注标记原样漏进了产物")
    assert.ok(html.includes(note), "脚注正文没有出现在页面上")
    assert.ok(
      html.indexOf(note) > html.indexOf("这里有个说法"),
      "脚注正文没有被折到句子下方（仍按行内展开）",
    )

    const sentence = plainText(html.slice(html.indexOf("这里有个说法"), html.indexOf("后面继续")))
    assert.ok(!sentence.includes(note), `脚注正文仍留在句子里：${sentence}`)

    // 引用可点：句子里有页内锚点链接，且锚点在页面里真实存在。
    const refs = [...html.matchAll(/<a\b[^>]*href="#([^"]+)"/gi)].map((m) => decodeURI(m[1]))
    assert.ok(refs.length > 0, "脚注没有渲染出可点击的引用")
    assert.ok(
      refs.some((id) => html.includes(`id="${id}"`)),
      "脚注引用指向的锚点在页面里不存在",
    )
  })

  test("![图|300](x.png) 的尺寸标记生效：宽度受限而非原图尺寸", () => {
    const html = page("语法.html")
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
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
    const kinds = callouts(html).map((callout) => callout.kind)
    for (const kind of ["note", "tip", "warning", "danger"]) {
      assert.ok(kinds.includes(kind), `缺 ${kind} 类型 callout：实际有 ${kinds.join(",")}`)
    }

    const css = [...artifacts.entries()]
      .filter(([artifact]) => artifact.endsWith(".css"))
      .map(([, body]) => body)
      .join("\n")
    const colors = calloutColors(css)
    const semantic = ["note", "tip", "warning", "danger"].map(
      (kind) => colors.get(kind) ?? colors.get(""),
    )
    for (const [index, kind] of ["note", "tip", "warning", "danger"].entries()) {
      assert.ok(semantic[index], `样式里没有 ${kind} 的语义色`)
    }
    assert.equal(new Set(semantic).size, 4, `四种语义色没有区分开：${semantic.join(",")}`)
  })

  test("[!note]- 默认折叠（内容仍在）且页面带展开机制", () => {
    const html = page("语法.html")
    const folded = callouts(html).find((callout) => plainText(callout.html).includes("折叠的笔记"))
    assert.ok(folded, "折叠 callout 没有渲染出来")
    assert.ok(folded!.collapsed, "折叠 callout 没有处于折叠状态")
    assert.ok(folded!.collapsible, "折叠 callout 不可折叠")
    assert.ok(
      plainText(folded!.html).includes("默认收起的正文"),
      "折叠把正文丢掉了，展开后没内容可看",
    )

    const open = callouts(html).find((callout) => plainText(callout.html).includes("提示标题"))
    assert.ok(open, "普通 callout 没有渲染出来")
    assert.ok(!open!.collapsed, "普通 callout 被误折叠")

    const scripts = [...artifacts.entries()]
      .filter(([artifact]) => artifact.endsWith(".js"))
      .map(([, body]) => body)
      .join("\n")
    assert.ok(
      /classList\.toggle/.test(scripts) && /is-collapsed/.test(scripts),
      "产物里没有可用的 callout 展开脚本",
    )
  })

  test("任务列表（勾选/未勾选）、表格、代码块、多级标题原样生效", () => {
    const html = page("语法.html")
    const boxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/gi)].map((m) => m[0])
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

    for (const [level, name] of [
      [2, "二级标题"],
      [3, "三级标题"],
      [4, "四级标题"],
    ] as const) {
      assert.match(
        html,
        new RegExp(`<h${level}\\b[^>]*\\bid="${name}"`),
        `${name} 没有渲染成 h${level}`,
      )
    }
  })

  test("属性面板只露出 description，内部字段不上页面", () => {
    const html = page("属性面板.html")
    assert.ok(html.includes("面板只该显示这一段描述。"), "属性面板没有显示 description")

    // 正对照：description 的键名本身该出现，否则下面的"不出现"可能只是面板整个没渲染。
    assert.ok(/description/.test(html), "产物里连 description 键都没有，面板可能没渲染")

    for (const leak of ["publish", "unlisted", "draft", "内部字段", "内部值不该出现在页面上"]) {
      assert.ok(!html.includes(leak), `内部字段漏到了页面上：${leak}`)
    }
  })

  test("嵌入页里的 callout 与任务列表仍然可用", () => {
    const html = page("嵌入语法.html")
    const kinds = callouts(html).map((callout) => callout.kind)
    for (const kind of ["note", "tip", "warning", "danger"]) {
      assert.ok(kinds.includes(kind), `嵌入页缺 ${kind} 类型 callout`)
    }
    const folded = callouts(html).find((callout) => plainText(callout.html).includes("折叠的笔记"))
    assert.ok(folded?.collapsed, "嵌入页里的折叠 callout 丢了折叠状态")

    const boxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/gi)]
    assert.equal(boxes.length, 2, `嵌入页任务列表复选框数量不对：${boxes.length}`)
    assert.ok(plainText(html).includes("已完成任务"), "嵌入页任务列表缺文字")

    assert.ok(!html.includes("![[语法]]"), "整篇嵌入仍是原始 wikilink 文本")
    assert.ok(!files.includes("语义不存在.html"))
  })
})
