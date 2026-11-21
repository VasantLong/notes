import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  buildSite,
  entry,
  listArtifacts,
  readTextArtifacts,
  repoRoot,
  tmpDir,
} from "./helpers/build"
import { anchors, isEncoded, plainText, resolveHref } from "./helpers/html"

const fixtureRoot = path.join(tmpDir, "tags")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string> = {
    "甲.md": entry(
      `publish: true
title: 甲
description: 前置字段里挂两个标签。
date: 2026-11-16
tags:
  - 概念
  - 工具`,
      "见 [[乙]]。",
    ),
    // 乙 的 frontmatter 没有 tags：标签只出现在正文里，靠 OFM 的 parseTags 并入。
    "乙.md": entry(
      `publish: true
title: 乙
description: 标签只写在正文里。
date: 2026-11-17`,
      "这一条属于 #工具 这一类。",
    ),
    "丙.md": entry(
      `publish: true
title: 丙
description: 一个标签都没有。
date: 2026-11-18`,
      "没有标签的条目。",
    ),
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

/** 指向某张标签页的锚点（产物页里 href 可能是相对或绝对，编码也可能是百分号或裸 UTF-8）。 */
const tagAnchors = (html: string) => anchors(html).filter((a) => a.classes.includes("tag-link"))

describe("标签：条目 ↔ 标签页", () => {
  let files: string[]
  let artifacts: Map<string, string>

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
  })

  const page = (rel: string) => {
    const text = artifacts.get(rel)
    assert.ok(text, `产物里缺 ${rel}`)
    return text
  }

  test("条目页把前置字段的标签渲染成通向标签页的链接", () => {
    const chips = tagAnchors(page("甲.html"))
    assert.deepEqual(chips.map((a) => a.text).sort(), ["工具", "概念"])

    for (const chip of chips) {
      const target = resolveHref(files, "甲.html", chip.href)
      assert.ok(target, `标签 ${chip.text} 的链接解析不到产物：${chip.href}`)
      assert.match(target, /^tags\//, `标签 ${chip.text} 应指向标签页，实际指向 ${target}`)
      assert.ok(isEncoded(chip.href), `中文标签的 href 应百分号编码，实际 ${chip.href}`)
    }
  })

  test("标签索引列出全部标签，并链到各自的标签页", () => {
    const index = page("tags/index.html")
    const text = plainText(index)
    assert.match(text, /概念/, "标签索引缺「概念」")
    assert.match(text, /工具/, "标签索引缺「工具」")

    for (const tag of ["概念", "工具"]) {
      const anchorsOnIndex = anchors(index)
      const link = anchorsOnIndex.find((a) => a.text === tag)
      assert.ok(link, `标签索引里没有可点的「${tag}」`)
      assert.ok(
        resolveHref(files, "tags/index.html", link.href),
        `标签索引里「${tag}」的链接解析不到产物：${link.href}`,
      )
    }
  })

  test("标签页列出该标签下的全部条目", () => {
    const tagPage = page("tags/概念.html")
    const listed = anchors(tagPage)
      .map((a) => resolveHref(files, "tags/概念.html", a.href))
      .filter((target): target is string => Boolean(target))

    assert.ok(listed.includes("甲.html"), "挂「概念」的条目没出现在这张标签页上")
    for (const other of ["乙.html", "丙.html"]) {
      assert.ok(!listed.includes(other), `没挂「概念」的 ${other} 不该出现在这张标签页上`)
    }
  })

  test("正文里的行内标签：渲染成链接，并把这条并进该标签页", () => {
    const inline = tagAnchors(page("乙.html")).find((a) => a.text === "工具")
    assert.ok(inline, "正文里的 #工具 没有渲染成标签链接")
    assert.ok(
      resolveHref(files, "乙.html", inline.href),
      `行内标签的链接解析不到产物：${inline.href}`,
    )

    // 乙 的 frontmatter 没有 tags，标签页收录它只能来自行内标签被并入。
    const toolPage = page("tags/工具.html")
    const listed = anchors(toolPage)
      .map((a) => resolveHref(files, "tags/工具.html", a.href))
      .filter((target): target is string => Boolean(target))
    assert.ok(listed.includes("乙.html"), "行内 #工具 没有让「工具」标签页收录这条")
    assert.ok(listed.includes("甲.html"), "前置字段挂「工具」的条目没出现在该标签页上")
  })

  test("没有标签的条目不显示标签列表", () => {
    assert.deepEqual(tagAnchors(page("丙.html")), [])
  })
})

describe("标签：真实花园库", () => {
  const realOut = path.join(fixtureRoot, "real-public")

  before(async () => {
    await buildSite({ contentDir: path.join(repoRoot, "content"), outDir: realOut })
  })

  test("真实条目页的标签可点，落在真实存在的标签页上", async () => {
    const files = await listArtifacts(realOut)
    const artifacts = await readTextArtifacts(realOut)
    const entryPage = "这座花园是什么.html"
    const html = artifacts.get(entryPage)
    assert.ok(html, `真实产物缺 ${entryPage}`)

    const chips = tagAnchors(html)
    assert.ok(chips.length > 0, "真实条目页没有可点的标签")
    for (const chip of chips) {
      const target = resolveHref(files, entryPage, chip.href)
      assert.ok(target, `标签 ${chip.text} 的链接解析不到产物：${chip.href}`)
      assert.match(target, /^tags\//)
      assert.ok(artifacts.has(target), `标签页 ${target} 不在产物里`)
    }
  })

  test("首页给出到标签索引的入口", async () => {
    const files = await listArtifacts(realOut)
    const artifacts = await readTextArtifacts(realOut)
    const home = artifacts.get("index.html")
    assert.ok(home, "真实产物缺 index.html")

    const link = anchors(home).find(
      (a) => resolveHref(files, "index.html", a.href) === "tags/index.html",
    )
    assert.ok(link, "首页没有通向 /tags/ 的入口")
  })
})
