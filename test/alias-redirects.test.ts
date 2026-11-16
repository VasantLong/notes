import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { buildSite, entry, listArtifacts, readTextArtifacts, tmpDir } from "./helpers/build"

const fixtureRoot = path.join(tmpDir, "alias-redirects")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

/**
 * 越界别名的落点：别名会被拼成 `<out>/../<别名>.html`，落到产物目录的上一级。
 * `../逃逸出界` 与 `../index` 都走这条口子（后者以 index 结尾，插件不当相对别名处理）。
 */
const escapedPaths = ["逃逸出界.html", "index.html"].map((name) => path.join(fixtureRoot, name))

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  for (const escaped of escapedPaths) await fs.rm(escaped, { force: true })
  const files: Record<string, string> = {
    "新名字.md": entry(
      `publish: true
title: 新名字
description: 改名之后的当前条目。
date: 2026-11-17
aliases:
  - 旧名字
  - 别处/更旧的笔记
  - 共同旧名`,
      "新名字独有的正文句子。",
    ),
    "占位页.md": entry(
      `publish: true
title: 占位页
description: 一条正常页面，用来验证别名不许顶掉它。
date: 2026-11-17`,
      "占位页独有的正文句子。",
    ),
    "抢别名页.md": entry(
      `publish: true
title: 抢别名页
description: 手写了一堆不该成立的危险别名。
date: 2026-11-17
aliases:
  - 占位页
  - index
  - 404
  - ./index
  - ../index
  - ../逃逸出界`,
      "抢别名页的正文。",
    ),
    "不存在页.md": entry(
      `title: 不存在页
description: 没标 publish，所以整条不该出现在产物里。
date: 2026-11-17
aliases:
  - 不存在的旧名`,
      "不存在页的正文。",
    ),
    "别处/深层笔记.md": entry(
      `publish: true
title: 深层笔记
description: 子目录条目，别名用 ../ 回到根上。
date: 2026-11-17
aliases:
  - ../别处旧名`,
      "深层笔记独有的正文句子。",
    ),
    "再抢一次.md": entry(
      `publish: true
title: 再抢一次
description: 与另一条笔记抢同一个别名。
date: 2026-11-17
aliases:
  - 共同旧名`,
      "再抢一次的正文。",
    ),
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

/** 跳转页的落点（meta refresh 里的 url），非跳转页返回 undefined。只认属性含义，不锁属性顺序与模板。 */
function redirectTarget(html: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/http-equiv="refresh"/i.test(tag)) continue
    const url = /url=([^"'>\s]+)/i.exec(tag)
    if (url) return decodeURI(url[1].trim())
  }
  return undefined
}

/** 从产物页面出发解析落点；去掉 `.html` 的干净 URL 两种形态都算命中。 */
function resolveTarget(files: string[], fromPage: string, target: string): string | undefined {
  const clean = target.split("#")[0]
  if (!clean || clean.startsWith("#")) return undefined
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPage), clean))
  return [base, `${base}.html`, path.posix.join(base, "index.html")].find((candidate) =>
    files.includes(candidate),
  )
}

let files: string[]
let artifacts: Map<string, string>

before(async () => {
  await writeVault()
  await buildSite({ contentDir: vault, outDir })
  files = await listArtifacts(outDir)
  artifacts = await readTextArtifacts(outDir)
})

describe("别名跳转：旧路径落到当前 URL", () => {
  test("旧别名产出跳转页，并落到改名后的当前 URL", () => {
    const html = artifacts.get("旧名字.html")
    assert.ok(html, "缺旧别名的跳转页 旧名字.html")
    const target = redirectTarget(html!)
    assert.ok(target, "旧别名产物不是跳转页")
    assert.equal(resolveTarget(files, "旧名字.html", target!), "新名字.html")
  })

  test("跳转是纯前端的：产物里没有服务端重定向配置", () => {
    assert.ok(redirectTarget(artifacts.get("旧名字.html")!), "跳转页没有 meta refresh")
    for (const serverSide of [
      "_redirects",
      "_headers",
      "netlify.toml",
      ".htaccess",
      "vercel.json",
    ]) {
      assert.ok(!files.includes(serverSide), `出现了服务端重定向配置：${serverSide}`)
    }
  })

  test("新 URL 是真页面，不存在链式多跳或循环", () => {
    const html = artifacts.get("新名字.html")
    assert.ok(html, "缺当前 URL 的页面 新名字.html")
    assert.equal(redirectTarget(html!), undefined, "当前 URL 仍然是跳转页（链式多跳）")
    assert.ok(html!.includes("新名字独有的正文句子"), "当前 URL 不是条目正文页")
    const target = redirectTarget(artifacts.get("旧名字.html")!)
    assert.ok(target, "旧别名产物不是跳转页")
    const resolved = resolveTarget(files, "旧名字.html", target)
    assert.ok(resolved, `跳转落点解析不到产物：${target}`)
    assert.notEqual(resolved, "旧名字.html", "别名指向了自己（跳转循环）")
  })

  test("多个别名同时成立：根级、子目录级、以及子目录条目的 ../ 别名", () => {
    const nested = artifacts.get("别处/更旧的笔记.html")
    assert.ok(nested, "缺子目录别名的跳转页 别处/更旧的笔记.html")
    const target = redirectTarget(nested!)
    assert.ok(target, "子目录别名产物不是跳转页")
    assert.equal(resolveTarget(files, "别处/更旧的笔记.html", target!), "新名字.html")

    // ../ 以条目所在目录为基准解析：别处/深层笔记 的 ../别处旧名 落在根上
    const upOne = artifacts.get("别处旧名.html")
    assert.ok(upOne, "缺 ../ 别名的跳转页 别处旧名.html")
    const upOneTarget = redirectTarget(upOne!)
    assert.ok(upOneTarget, "../ 别名产物不是跳转页")
    assert.equal(resolveTarget(files, "别处旧名.html", upOneTarget!), "别处/深层笔记.html")
  })

  test("每一条跳转页的落点都存在，不存在会 404 的死跳转", () => {
    const redirects = [...artifacts].filter(([, html]) => redirectTarget(html) !== undefined)
    assert.ok(redirects.length > 0, "一条跳转页都没有产出，检查无从谈起")
    for (const [page, html] of redirects) {
      const target = redirectTarget(html)!
      assert.ok(resolveTarget(files, page, target), `${page} 跳到不存在的 ${target}`)
    }
  })

  test("不存在的条目（没标 publish）声明的别名不产出跳转页", () => {
    assert.ok(!files.includes("不存在的旧名.html"), "不存在的条目仍产出了跳转页")
  })
})

describe("别名跳转：不许盖掉站点自己的页面", () => {
  // 插件自己也会跳过与内容页撞名的别名，这条测试守的是产物不变量（原条目页面不被顶掉），守卫只是多一条诊断
  test("别名与已发布条目撞名时，原条目页面保留", () => {
    const html = artifacts.get("占位页.html")
    assert.ok(html, "缺 占位页.html")
    assert.equal(redirectTarget(html!), undefined, "别名顶掉了同名条目，占位页 变成了跳转页")
    assert.ok(html!.includes("占位页独有的正文句子"), "占位页 不是条目正文页")
  })

  test("别名不能凭空造出站点首页 index.html", () => {
    // 前提：这个 fixture 花园库没有 index.md，产物里本就不该有首页
    assert.ok(!files.includes("index.md"), "fixture 长出 index.md 了，这条断言需要重写")
    assert.ok(!files.includes("index.html"), "别名 index 造出了站点首页 index.html")
  })

  test("别名不能占用 404 页", () => {
    const html = artifacts.get("404.html")
    assert.ok(html, "缺 404.html")
    assert.equal(redirectTarget(html!), undefined, "别名顶掉了 404 页")
  })

  test("别名被两页抢用时归属确定：内容顺序在先者得，且不再多跳一层", () => {
    const target = redirectTarget(artifacts.get("共同旧名.html")!)
    assert.ok(target, "共同旧名.html 不是跳转页")
    const resolved = resolveTarget(files, "共同旧名.html", target)
    // 全量构建按路径排序喂内容，申报者是这两条笔记：先者得
    const firstClaimant = ["新名字", "再抢一次"].sort()[0]
    assert.equal(resolved, `${firstClaimant}.html`)
    assert.equal(
      redirectTarget(artifacts.get(resolved!)!),
      undefined,
      `${resolved} 还是跳转页（多跳一层）`,
    )
  })

  test("越界的别名（.. 穿透产物目录）被丢弃", async () => {
    for (const escaped of escapedPaths) {
      await assert.rejects(
        fs.access(escaped),
        { code: "ENOENT" },
        `别名把文件写到了产物目录之外：${escaped}`,
      )
    }
  })
})
