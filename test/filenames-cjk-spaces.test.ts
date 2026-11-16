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
import { anchors, anchorFor, imageSources, isEncoded, resolveHref } from "./helpers/html"

const fixtureRoot = path.join(tmpDir, "filenames-cjk-spaces")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const files: Record<string, string | Buffer> = {
  "链接页.md": entry(
    `publish: true
title: 链接页
description: 指向含空格与中文文件名的双链与嵌入。
date: 2026-11-17`,
    `双链：[[带 空格 的笔记]]

中文双链：[[中文条目#小节]]

子目录双链：[[子 目录/深 层笔记#深 节]]

图片：![[图 片.png]]

百分号图片：![](attachments/%E5%9B%BE%20%E7%89%87.png)

嵌入小节：![[子 目录/深 层笔记#深 节]]
`,
  ),
  "带 空格 的笔记.md": entry(
    `publish: true
title: 带空格的标题
description: 文件名含空格，正文用来验证内容进索引。
date: 2026-11-17`,
    `空格页独有句子。
`,
  ),
  "中文条目.md": entry(
    `publish: true
title: 中文条目
description: 文件名是纯中文，不转写。
date: 2026-11-17`,
    `## 小节

小节独有句子。
`,
  ),
  "子 目录/深 层笔记.md": entry(
    `publish: true
title: 深层笔记
description: 目录名和文件名都含空格。
date: 2026-11-17`,
    `## 深 节

深层独有句子。
`,
  ),
  "attachments/图 片.png": pngFixture,
}

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

let artifacts: string[]
let pages: Map<string, string>

before(async () => {
  await writeVault()
  await buildSite({ contentDir: vault, outDir })
  artifacts = await listArtifacts(outDir)
  pages = await readTextArtifacts(outDir)
})

describe("中文与含空格文件名：产物路径", () => {
  test("空格转成 -，中文保持原样，不被转写或拼音化", () => {
    for (const expected of [
      "带-空格-的笔记.html",
      "中文条目.html",
      "子-目录/深-层笔记.html",
      "attachments/图-片.png",
    ]) {
      assert.ok(artifacts.includes(expected), `缺产物 ${expected}；实际有：${artifacts.join(", ")}`)
    }
    assert.ok(!artifacts.includes("带 空格 的笔记.html"), "产物名里的空格没有替换成 -")
  })

  test("产物路径是解码后的中文，没有百分号编码", () => {
    for (const artifact of artifacts) {
      assert.ok(!artifact.includes("%"), `产物路径里残留了百分号编码：${artifact}`)
    }
  })
})

describe("中文与含空格文件名：链接与嵌入", () => {
  const page = () => {
    const html = pages.get("链接页.html")
    assert.ok(html, "缺 链接页.html")
    return html!
  }

  test("[[带 空格 的笔记]] 指向 - 化后的那一份产物，显示文本仍是原名", () => {
    const link = anchorFor(anchors(page()), "带 空格 的笔记")
    assert.ok(link, "含空格的双链没有渲染")
    assert.equal(resolveHref(artifacts, "链接页.html", link!.href), "带-空格-的笔记.html")
    assert.ok(!link!.text.includes("%"), "链接显示文本被编码了")
  })

  test("[[中文条目#小节]] 的中文不被转写，锚点落在目标页上", () => {
    const link = anchors(page()).find((a) => a.text.startsWith("中文条目"))
    assert.ok(link, "中文双链没有渲染")
    assert.equal(resolveHref(artifacts, "链接页.html", link!.href), "中文条目.html")
    assert.ok(isEncoded(link!.href), `页面内的锚点链接没有百分号编码：${link!.href}`)

    const target = pages.get("中文条目.html")!
    const id = decodeURI(link!.href.split("#")[1])
    assert.equal(id, "小节")
    assert.ok(target.includes(`id="${id}"`), `目标页缺锚点 ${id}`)
  })

  test("目录名和文件名都含空格的双链解析到同一份产物", () => {
    const link = anchors(page()).find((a) => a.text.startsWith("子 目录"))
    assert.ok(link, "子目录双链没有渲染")
    assert.equal(resolveHref(artifacts, "链接页.html", link!.href), "子-目录/深-层笔记.html")
    assert.equal(decodeURI(link!.href.split("#")[1]), "深-节")
    assert.ok(pages.get("子-目录/深-层笔记.html")!.includes(`id="深-节"`))
  })

  test("双链形式的附件与百分号形式的附件都指向同一张图", () => {
    const sources = imageSources(page())
    assert.equal(sources.length, 2, `期望两张 <img>，实际：${JSON.stringify(sources)}`)
    for (const src of sources) {
      assert.equal(
        resolveHref(artifacts, "链接页.html", src),
        "attachments/图-片.png",
        `附件地址解析不到产物：${src}`,
      )
    }
  })

  test("嵌入小节带着中文锚点，内容被完整转写", () => {
    assert.ok(page().includes("深层独有句子"), "小节嵌入没有带进正文")
  })

  test("指向中文/空格产物的内部 URL 百分号编码，且编码/解码往返一致", () => {
    const html = page()
    const list = anchors(html)
    const urls = [
      anchorFor(list, "带 空格 的笔记")!.href,
      list.find((a) => a.text.startsWith("中文条目"))!.href,
      list.find((a) => a.text.startsWith("子 目录"))!.href,
      ...imageSources(html),
    ]
    assert.equal(urls.length, 5, "没找到足够的内部链接来做编码断言")
    for (const url of urls) {
      assert.ok(isEncoded(url), `内部 URL 没有百分号编码：${url}`)
      assert.ok(
        resolveHref(artifacts, "链接页.html", url),
        `解码后的 URL 解析不到产物（往返不成立）：${url}`,
      )
      assert.ok(!/\s/.test(url), `URL 里残留裸空白，复制进浏览器不再成立：${url}`)
    }
  })
})

describe("中文与含空格文件名：站点索引", () => {
  const index = () => {
    const raw = pages.get("static/contentIndex.json")
    assert.ok(raw, "缺 static/contentIndex.json")
    return JSON.parse(raw!) as Record<
      string,
      { slug: string; filePath: string; title: string; content: string; links: string[] }
    >
  }

  test("索引用 slug 做键，但保留原文件名 filePath", () => {
    const entries = index()
    assert.equal(entries["带-空格-的笔记"]?.filePath, "带 空格 的笔记.md")
    assert.equal(entries["中文条目"]?.filePath, "中文条目.md")
    assert.equal(entries["子-目录/深-层笔记"]?.filePath, "子 目录/深 层笔记.md")
  })

  test("索引里的键、slug、filePath 都是解码文本，没有百分号编码", () => {
    for (const [key, value] of Object.entries(index())) {
      for (const field of [key, value.slug, value.filePath]) {
        assert.ok(!field.includes("%"), `索引里出现编码后的路径：${field}`)
      }
    }
  })

  test("索引保留了中文正文供搜索使用", () => {
    const entries = index()
    assert.ok(entries["带-空格-的笔记"]?.content.includes("空格页独有句子"))
    assert.ok(entries["中文条目"]?.content.includes("小节独有句子"))
  })

  test("条目标题仍是人写的名字，不是 slug", () => {
    assert.equal(index()["带-空格-的笔记"]?.title, "带空格的标题")
  })

  test("站点地图里的中文 URL 已编码，且不含裸空格", () => {
    const sitemap = pages.get("sitemap.xml")
    assert.ok(sitemap, "缺 sitemap.xml")
    assert.ok(sitemap!.includes(encodeURI("带-空格-的笔记")), "站点地图没有出现编码后的中文 slug")
    const locations = [...sitemap!.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    assert.ok(locations.length > 0)
    for (const loc of locations) {
      assert.ok(!/\s/.test(loc), `站点地图 URL 里有裸空格：${loc}`)
      assert.ok(!/[\u4e00-\u9fff]/.test(loc), `站点地图 URL 里还有未编码的中文：${loc}`)
    }
  })
})
