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
import { anchors, anchorFor, resolveHref, withoutAnchor } from "./helpers/html"

const fixtureRoot = path.join(tmpDir, "links-and-embeds")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string | Buffer> = {
    "目标笔记.md": entry(
      `publish: true
title: 目标笔记
description: 被链接与被嵌入的目标。
date: 2026-11-16`,
      `## 甲节

甲节独有的句子。

## 乙节

乙节独有的句子。

- [ ] 未完成任务
- [x] 已完成任务

| 列一 | 列二 |
| --- | --- |
| 甲 | 乙 |
`,
    ),
    "别处/深层笔记.md": entry(
      `publish: true
title: 深层笔记
description: 放在子目录里，靠最短路径解析。
date: 2026-11-16`,
      "深层笔记的正文。",
    ),
    "半截笔记.md": entry(
      `title: 半截笔记标题
description: 还没写完，没标 publish。`,
      "这半截不该被读到。",
    ),
    "双链与别名.md": entry(
      `publish: true
title: 双链与别名
description: 三种双链形态。
date: 2026-11-16`,
      `双链：[[目标笔记]]

别名：[[目标笔记|自定义别名]]

小节跳转：[[目标笔记#甲节]]

最短路径：[[深层笔记]]
`,
    ),
    "嵌入整篇.md": entry(
      `publish: true
title: 嵌入整篇
description: 整篇嵌入目标笔记。
date: 2026-11-16`,
      `![[目标笔记]]
`,
    ),
    "嵌入小节.md": entry(
      `publish: true
title: 嵌入小节
description: 只嵌入目标笔记的一节。
date: 2026-11-16`,
      `![[目标笔记#乙节]]
`,
    ),
    "嵌入图片.md": entry(
      `publish: true
title: 嵌入图片
description: 引用花园库附件。
date: 2026-11-16`,
      `![[图.png]]
`,
    ),
    "指向未发布.md": entry(
      `publish: true
title: 指向未发布
description: 链接指向还没发布的笔记。
date: 2026-11-16`,
      `指向未发布：[[半截笔记]]

指向不存在：[[根本没有这篇]]

指向已发布：[[目标笔记]]
`,
    ),
    "attachments/图.png": pngFixture,
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

describe("链接与嵌入：双链", () => {
  let files: string[]
  let artifacts: Map<string, string>

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
  })

  test("[[笔记]] 是指向该条目页面的可点链接", () => {
    const html = artifacts.get("双链与别名.html")
    assert.ok(html, "缺 双链与别名.html")
    const link = anchorFor(anchors(html!), "目标笔记")
    assert.ok(link, "双链没有渲染成带目标文件名的链接")
    assert.ok(!withoutAnchor(link!.href).startsWith("http"), "内部链接不该指向外部")
    assert.ok(
      resolveHref(files, "双链与别名.html", link!.href),
      `链接解析不到产物页面：${link!.href}`,
    )
  })

  test("[[笔记|别名]] 显示别名，不显示文件名", () => {
    const list = anchors(artifacts.get("双链与别名.html")!)
    const alias = anchorFor(list, "自定义别名")
    assert.ok(alias, "别名没有作为链接文字出现")
    assert.ok(!alias!.text.includes("目标笔记"), "别名链接仍显示文件名")
    assert.ok(
      resolveHref(files, "双链与别名.html", alias!.href),
      `别名链接解析不到产物页面：${alias!.href}`,
    )
  })

  test("[[笔记#小节]] 跳到该小节，且目标页里锚点存在", () => {
    const list = anchors(artifacts.get("双链与别名.html")!)
    const section = list.find((a) => decodeURI(a.href).includes("#甲节"))
    assert.ok(section, "小节链接没有带锚点")
    const target = resolveHref(files, "双链与别名.html", section!.href)
    assert.ok(target, `小节链接解析不到产物页面：${section!.href}`)
    const targetHtml = artifacts.get(target!)
    assert.ok(targetHtml, `目标页不是可读产物：${target}`)
    const anchorId = decodeURI(section!.href.split("#")[1])
    assert.ok(targetHtml!.includes(`id="${anchorId}"`), `目标页里没有 ${anchorId} 的锚点`)
  })

  test("链接按最短路径解析：子目录里的笔记用裸文件名就能连上", () => {
    const list = anchors(artifacts.get("双链与别名.html")!)
    const link = anchorFor(list, "深层笔记")
    assert.ok(link, "裸文件名双链没有渲染")
    assert.equal(
      resolveHref(files, "双链与别名.html", link!.href),
      "别处/深层笔记.html",
      "最短路径没有解析到子目录里的页面",
    )
  })

  test("![[笔记]] 整篇嵌入：目标页的每一节都出现", () => {
    const html = artifacts.get("嵌入整篇.html")
    assert.ok(html, "缺 嵌入整篇.html")
    assert.ok(html!.includes("甲节独有的句子"), "整篇嵌入缺第一节")
    assert.ok(html!.includes("乙节独有的句子"), "整篇嵌入缺第二节")
  })

  test("嵌入页里的任务列表与表格保持可用", () => {
    const html = artifacts.get("嵌入整篇.html")!
    assert.match(html, /<input[^>]*type="checkbox"/i, "任务列表没有渲染成复选框")
    assert.match(html, /<table[\s>]/i, "表格没有渲染成表格")
    for (const text of ["未完成任务", "已完成任务", "列一", "列二"]) {
      assert.ok(html.includes(text), `嵌入内容缺表格/任务列表文字：${text}`)
    }
    assert.ok(!/\|\s*列一\s*\|/.test(html), "表格仍是原始 Markdown 文本")
  })

  test("![[笔记#小节]] 只嵌那一节", () => {
    // 正对照：目标页本身两节都在，否则下面的「不含」会假通过。
    const target = artifacts.get("目标笔记.html")
    assert.ok(target, "缺 目标笔记.html")
    assert.ok(target!.includes("甲节独有的句子") && target!.includes("乙节独有的句子"))

    const html = artifacts.get("嵌入小节.html")
    assert.ok(html, "缺 嵌入小节.html")
    assert.ok(html!.includes("乙节独有的句子"), "小节嵌入缺目标小节")
    assert.ok(!html!.includes("甲节独有的句子"), "小节嵌入把别的小节也带进来了")
  })

  test("![[图片]] 引用花园库附件，且附件出现在产物里", () => {
    const html = artifacts.get("嵌入图片.html")
    assert.ok(html, "缺 嵌入图片.html")
    const src = /<img\b[^>]*\bsrc="([^"]+)"/i.exec(html!)?.[1]
    assert.ok(src, "图片嵌入没有产出 <img>")
    const resolved = resolveHref(files, "嵌入图片.html", src!)
    assert.ok(resolved, `图片地址解析不到产物文件：${src}`)
    assert.ok(resolved!.endsWith("图.png"), `解析到的是别的文件：${resolved}`)
  })

  test("指向未发布/不存在笔记的链接被视觉标出，既不静默变死链也不退化成普通文本", () => {
    const page = artifacts.get("指向未发布.html")
    assert.ok(page, "缺 指向未发布.html")
    const list = anchors(page!)
    const working = anchorFor(list, "目标笔记")
    const unpublished = anchorFor(list, "半截笔记")
    const missing = anchorFor(list, "根本没有这篇")
    assert.ok(working, "正对照：指向已发布笔记的链接应正常渲染")
    assert.ok(unpublished, "指向未发布笔记的链接退化成普通文本")
    assert.ok(missing, "指向不存在笔记的链接退化成普通文本")
    assert.ok(!page!.includes("[[半截笔记]]"), "wikilink 原样漏进了产物")

    // 标记 = 正常链接没有的 class：不锁具体类名，只要求「可区分」。
    const markers = (link: Anchor) => link.classes.filter((c) => !working!.classes.includes(c))
    assert.ok(markers(unpublished!).length > 0, "指向未发布笔记的链接与正常链接外观无差别")
    assert.ok(markers(missing!).length > 0, "指向不存在笔记的链接与正常链接外观无差别")

    // 未发布笔记本身仍不存在。
    assert.ok(!files.includes("半截笔记.html"))
  })
})
