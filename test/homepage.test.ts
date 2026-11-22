import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { parse as parseYaml } from "yaml"

import {
  buildSite,
  entry,
  listArtifacts,
  readTextArtifacts,
  repoRoot,
  tmpDir,
} from "./helpers/build"
import { anchorFor, anchors, isEncoded, resolveHref } from "./helpers/html"

/**
 * 票 13：站点首页。
 *
 * 断言分两层：
 * 1. 真实花园库——`content/index.md` 是条目、构建后产物根有 index.html；
 *    这一层是「域名根路径不再是 404」的唯一硬证据，fixture 替代不了它。
 * 2. fixture——首页的语义不变量（站内链接命中产物且编码、指向未发布条目被标出、
 *    首页不出现在自己的反链里），与作者写什么内容无关。
 */

const fixtureRoot = path.join(tmpDir, "homepage")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string> = {
    // 首页自己也是条目：四字段齐备，title 是 reader 看到的第一句话。
    "index.md": entry(
      `publish: true
title: 门口页
description: 花园的门口。
date: 2026-11-21`,
      `从这里开始：[[条目甲]]，也见 [[带 空格]]。

指向未发布：[[半截笔记]]。`,
    ),
    // 反向链接的来源：它链回首页，于是首页的反链里应当出现它。
    "条目甲.md": entry(
      `publish: true
title: 条目甲
description: 一篇普通条目。
date: 2026-11-21`,
      "回到 [[index]]。",
    ),
    "带 空格.md": entry(
      `publish: true
title: 带空格
description: 文件名含空格。
date: 2026-11-21`,
      "正文。",
    ),
    // 没标 publish：站点上不存在，首页指向它的链接必须被标出。
    "半截笔记.md": `---
title: 半截笔记
---

草稿。`,
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

describe("首页（fixture 花园库）", () => {
  let artifacts: Map<string, string>
  let files: string[]

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    artifacts = await readTextArtifacts(outDir)
    files = await listArtifacts(outDir)
  })

  test("根路径有页面：产物根目录里是 index.html，不是 404", () => {
    assert.ok(
      files.includes("index.html"),
      `产物根缺 index.html，实际：${files.slice(0, 8).join("、")}`,
    )
    assert.ok(artifacts.has("404.html"), "404 页不该被首页顶掉")
  })

  test("<title> 取自首页 frontmatter 的 title", () => {
    const html = artifacts.get("index.html")!
    assert.match(html, /<title>门口页<\/title>/)
  })

  test("首页的站内链接命中真实产物，中文与空格都百分号编码", () => {
    const html = artifacts.get("index.html")!
    const list = anchors(html)
    const plain = anchorFor(list, "条目甲")
    const spaced = anchorFor(list, "带 空格")
    assert.ok(plain, "首页缺指向 条目甲 的链接")
    assert.ok(spaced, "首页缺指向 带 空格 的链接")
    assert.equal(
      resolveHref(files, "index.html", plain!.href),
      "条目甲.html",
      `指向 条目甲 的链接解析不到产物：${plain!.href}`,
    )
    assert.ok(isEncoded(spaced!.href), `含空格的文件名没有编码：${spaced!.href}`)
    // 产物文件名把空格换成连字符（slug），链接文本仍是花园库里的名字。
    assert.equal(resolveHref(files, "index.html", spaced!.href), "带-空格.html")
  })

  test("指向未发布条目的链接被标出，未发布条目仍不存在", () => {
    const html = artifacts.get("index.html")!
    const list = anchors(html)
    const working = anchorFor(list, "条目甲")
    const unpublished = anchorFor(list, "半截笔记")
    assert.ok(working, "正对照：指向已发布条目的链接应正常渲染")
    assert.ok(unpublished, "指向未发布条目的链接退化成普通文本")
    assert.ok(
      unpublished!.classes.some((c) => !working!.classes.includes(c)),
      "指向未发布条目的链接与正常链接外观无差别",
    )
    assert.ok(!files.includes("半截笔记.html"), "未发布条目进了产物")
  })

  test("首页不出现在自己的反链里，反链只列真正引用它的页面", () => {
    const html = artifacts.get("index.html")!
    const start = html.indexOf("反向链接")
    const end = html.indexOf('class="site-footer"')
    assert.ok(start > 0, "首页没有反向链接区")
    const section = html.slice(start, end > start ? end : undefined)
    const sources = anchors(section)
      .map((link) => resolveHref(files, "index.html", link.href))
      .filter((target): target is string => Boolean(target))
    assert.ok(!sources.includes("index.html"), "首页把自己列进了反链")
    assert.ok(
      sources.includes("条目甲.html"),
      `首页反链应含 条目甲.html，实际：${sources.join("、")}`,
    )
  })
})

describe("首页（真实花园库）", () => {
  const realOut = path.join(tmpDir, "homepage-real", "public")
  let realArtifacts: Map<string, string>
  let realFiles: string[]

  before(async () => {
    await buildSite({ contentDir: path.join(repoRoot, "content"), outDir: realOut })
    realArtifacts = await readTextArtifacts(realOut)
    realFiles = await listArtifacts(realOut)
  })

  test("content/index.md 存在且满足条目契约（publish/title/description/date）", async () => {
    const indexPath = path.join(repoRoot, "content", "index.md")
    const raw = await fs.readFile(indexPath, "utf8").catch(() => "")
    assert.ok(raw, "缺 content/index.md：根路径没有页面可发")

    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? ""
    const data = parseYaml(frontmatter) as Record<string, unknown>
    assert.equal(data.publish, true, "首页必须标 publish: true")
    for (const field of ["title", "description", "date"]) {
      assert.ok(data[field], `首页缺 ${field}`)
    }

    const cli = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      ["scripts/check-entries.ts", "--dir", "content"],
      { cwd: repoRoot, encoding: "utf8" },
    )
    assert.equal(cli.status, 0, `条目契约校验未通过：${cli.stdout}${cli.stderr}`)
  })

  test("真实构建产物根有 index.html，标题取自首页 frontmatter", async () => {
    assert.ok(realFiles.includes("index.html"), "真实产物缺 index.html：域名根路径仍是 404")
    const raw = await fs.readFile(path.join(repoRoot, "content", "index.md"), "utf8")
    const data = parseYaml(/^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? "") as Record<string, string>
    const html = realArtifacts.get("index.html")!
    assert.ok(
      html.includes(`<title>${data.title}</title>`),
      `首页 <title> 不是 frontmatter 的 title（${data.title}）`,
    )
    assert.ok(realArtifacts.has("404.html"), "404 页仍在")
  })
})
