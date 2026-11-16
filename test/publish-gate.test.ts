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

const fixtureRoot = path.join(tmpDir, "publish-gate")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string | Buffer> = {
    "已发布条目.md": entry(
      `publish: true
title: 花园里的条目
description: 这条会出现在站点上。
date: 2026-11-16`,
      `正文一张图：![](attachments/图.png)

%%私有批注：这一段不该出现在产物里%%

指向[未列出页](未列出页)的链接。`,
    ),
    "半截笔记.md": entry(
      `title: 半截笔记标题
description: 还没写完，没标 publish。`,
      "这半截不该被读到。",
    ),
    "草稿.md": entry(
      `publish: true
draft: true
title: 草稿标题
description: 标了草稿。
date: 2026-11-16`,
      "草稿正文。",
    ),
    "未列出页.md": entry(
      `publish: true
unlisted: true
title: 未列出标题
description: 直链能看，但索引里没有。
date: 2026-11-16`,
      "只有知道链接的人才看得到。",
    ),
    "带 空格 的笔记.md": entry(
      `publish: true
title: 带空格的笔记
description: 文件名里有空格。
date: 2026-11-16`,
      "空格要变成连字符。",
    ),
    "private/私有页.md": entry(
      `publish: true
title: 私有标题
description: 在 private 目录里。
date: 2026-11-16`,
      "private 目录永不进构建。",
    ),
    "templates/模板.md": "---\ntitle: 模板标题\n---\n\n{{placeholder}}\n",
    "inbox/待读.md": entry(
      `publish: true
title: 待读标题
description: 在 inbox 里。
date: 2026-11-16`,
      "inbox 永不进构建。",
    ),
    "attachments/图.png": pngFixture,
    "attachments/未引用.png": pngFixture,
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

describe("发布闸门：四种发布态在产物层面互不重叠", () => {
  let artifacts: Map<string, string>
  let files: string[]

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
  })

  const occurrences = (needle: string) =>
    [...artifacts.entries()].filter(([, content]) => content.includes(needle)).map(([name]) => name)

  test("已发布条目有 HTML，页面标题取自 frontmatter 而非文件名", () => {
    assert.ok(
      files.includes("已发布条目.html"),
      `缺 已发布条目.html，实际：${files.filter((f) => f.endsWith(".html"))}`,
    )
    // 标题刻意与文件名不同：若 Quartz 回落到文件名，这条断言就会失败。
    assert.ok(artifacts.get("已发布条目.html")!.includes("<title>花园里的条目</title>"))
  })

  test("没标 publish 的笔记不存在：无 HTML，标题在全部产物里零命中", () => {
    assert.ok(!files.includes("半截笔记.html"))
    assert.deepEqual(occurrences("半截笔记标题"), [])
  })

  test("draft: true 即使同时 publish: true 也不进构建", () => {
    assert.ok(!files.includes("草稿.html"))
    assert.deepEqual(occurrences("草稿标题"), [])
  })

  test("%%私有批注%% 的内部文字零命中", () => {
    assert.deepEqual(occurrences("私有批注"), [])
  })

  test("private/、templates/、inbox/ 的内容不进产物", () => {
    for (const rel of ["private/私有页.html", "templates/模板.html", "inbox/待读.html"]) {
      assert.ok(!files.includes(rel), rel + " 不该出现在产物里")
    }
    assert.deepEqual(occurrences("私有标题"), [])
    assert.deepEqual(occurrences("模板标题"), [])
    assert.deepEqual(occurrences("待读标题"), [])
  })

  test("未被引用的附件不上线，被引用的附件在", () => {
    assert.ok(
      files.some((f) => f.startsWith("attachments/图")),
      `被引用的附件应该在：${files.filter((f) => f.startsWith("attachments/"))}`,
    )
    assert.ok(!files.some((f) => f.includes("未引用")), "未被引用的附件不该上线")
  })

  test("unlisted 页直链可达，但不进 contentIndex / sitemap", () => {
    assert.ok(files.includes("未列出页.html"), "unlisted 页要有 HTML")
    assert.ok(artifacts.get("未列出页.html")!.includes("未列出标题"))

    const contentIndex = artifacts.get("static/contentIndex.json")
    assert.ok(contentIndex, "缺 static/contentIndex.json")
    // 正对照：索引确实收录了已发布条目，否则下面两条「不含」会假通过。
    assert.ok(contentIndex!.includes("花园里的条目"), "contentIndex 应收录已发布条目")
    assert.ok(!contentIndex!.includes("未列出标题"), "unlisted 页不该进 contentIndex")

    // sitemap 里的 slug 是百分号编码的，正反两条断言都要按编码后的形状比对。
    const sitemap = artifacts.get("sitemap.xml")
    assert.ok(sitemap, "缺 sitemap.xml")
    assert.ok(sitemap!.includes(encodeURIComponent("已发布条目")), "sitemap 应收录已发布条目")
    assert.ok(!sitemap!.includes(encodeURIComponent("未列出页")), "unlisted 页不该进 sitemap")
  })

  test("有 sitemap.xml，没有 index.xml（RSS 保持关闭）", () => {
    assert.ok(artifacts.has("sitemap.xml"), "缺 sitemap.xml")
    assert.ok(!files.includes("index.xml"), "RSS 已关闭，不该有 index.xml")
  })

  test("文件名里的空格变成连字符，中文不转写", () => {
    assert.ok(
      files.includes("带-空格-的笔记.html"),
      `实际：${files.filter((f) => f.includes("带"))}`,
    )
  })
})

describe("发布闸门：字段校验接在构建路径上", () => {
  const badRoot = path.join(tmpDir, "publish-gate-bad")

  test("缺字段的条目让构建在产物落地前失败，并指出文件与字段", async () => {
    const contentDir = path.join(badRoot, "content")
    const badOut = path.join(badRoot, "public")
    await fs.rm(badRoot, { recursive: true, force: true })
    await fs.mkdir(contentDir, { recursive: true })
    await fs.writeFile(
      path.join(contentDir, "缺标题.md"),
      entry(`publish: true
description: 有描述没标题。
date: 2026-11-16`),
      "utf8",
    )

    let error: { stdout?: string; stderr?: string } | undefined
    try {
      await buildSite({ contentDir, outDir: badOut })
    } catch (err) {
      error = err as { stdout?: string; stderr?: string }
    }
    assert.ok(error, "坏条目必须让构建失败")
    const output = (error?.stdout ?? "") + (error?.stderr ?? "")
    assert.match(output, /缺标题\.md/, `要指出文件：${output}`)
    assert.match(output, /title/, `要指出字段：${output}`)

    const emitted = await listArtifacts(badOut).catch(() => [])
    assert.deepEqual(
      emitted.filter((f) => f.endsWith(".html") && f !== "404.html"),
      [],
      "坏条目不该留下任何页面",
    )
  })
})
