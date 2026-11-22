import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  buildSite,
  entry,
  listArtifacts,
  readTextArtifacts,
  siteBaseUrl,
  thirdPartyRequests,
  tmpDir,
} from "./helpers/build"
import { anchors, isEncoded, plainText, resolveHref, withoutAnchor } from "./helpers/html"

const fixtureRoot = path.join(tmpDir, "navigation-and-reading")
const vault = path.join(fixtureRoot, "content")
const outDir = path.join(fixtureRoot, "public")

const deepPage = "别处/更深/深层条目.html"

const writeVault = async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  const files: Record<string, string> = {
    "根条目.md": entry(
      `publish: true
title: 根条目
description: 根目录的条目。
date: 2026-11-16`,
      "见 [[深层条目]]。",
    ),
    "别处/中层.md": entry(
      `publish: true
title: 中层
description: 子目录里的条目。
date: 2026-11-16`,
      "见 [[深层条目]]。",
    ),
    "别处/更深/深层条目.md": entry(
      `publish: true
title: 深层条目
description: 最深的条目。
date: 2026-11-16`,
      `## 小节甲

正文。

## 小节乙

正文。

见 [[根条目]]。
`,
    ),
    "带 空格.md": entry(
      `publish: true
title: 带空格
description: 文件名含空格。
date: 2026-11-16`,
      "见 [[深层条目]]。",
    ),
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(vault, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body)
  }
}

/** 站内链接：不是外部协议、也不是纯页内锚点。 */
const isInternalHref = (href: string) =>
  href !== "" && !href.startsWith("#") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)

/** 样式表的规则：选择器列表 + 声明块，用来问"哪条规则管这个元素"。 */
const styleRules = (css: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(",").map((s) => s.trim()),
    body: m[2],
  }))

/** 样式表里有没有一条规则：选择器列表含 selector，且声明里含 declaration。 */
const hasRule = (css: string, selector: string, declaration: string) =>
  styleRules(css).some(
    (rule) => rule.selectors.includes(selector) && rule.body.includes(declaration),
  )

describe("导航与阅读面：组件生成的站内链接", () => {
  let files: string[]
  let artifacts: Map<string, string>
  let deepHtml: string

  /** 脚本闭包：页面脚本只 import 入口，真正的按键绑定在被 import 的静态脚本里。 */
  const scriptClosure = (fromPage: string, html: string): string[] => {
    const queue = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map((m) => resolveHref(files, fromPage, m[1]))
      .filter((p): p is string => Boolean(p))
    const seen = new Set<string>()
    while (queue.length > 0) {
      const current = queue.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      const code = artifacts.get(current) ?? ""
      for (const m of code.matchAll(/(?:import|from)\s*\(?\s*["']([^"']+)["']/g)) {
        const next = resolveHref(files, current, m[1])
        if (next) queue.push(next)
      }
    }
    return [...seen]
  }

  /** 页面的内联脚本：发布索引的取数直接写在页面上，没有分包成文件。 */
  const inlineScripts = (html: string): string[] =>
    [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])

  /** 页面真正加载的样式表（去掉自托管第三方 vendor）：按页解析，而不是拿全站 CSS 凑数。 */
  const pageStyles = (fromPage: string, html: string): string =>
    [...html.matchAll(/<link\b[^>]*>/g)]
      .filter((m) => /\brel="stylesheet"/.test(m[0]))
      .map((m) => /\bhref="([^"]+)"/.exec(m[0])?.[1])
      .filter((href): href is string => Boolean(href))
      .map((href) => resolveHref(files, fromPage, href))
      .filter((rel): rel is string => Boolean(rel) && !rel!.includes("vendor/"))
      .map((rel) => artifacts.get(rel) ?? "")
      .join("\n")

  before(async () => {
    await writeVault()
    await buildSite({ contentDir: vault, outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
    deepHtml = artifacts.get(deepPage) ?? ""
    assert.ok(deepHtml, `缺产物页 ${deepPage}`)
  })

  test("产物里每一页的站内 href 都是能解析到产物的 URI 引用", () => {
    let checked = 0
    for (const [rel, html] of artifacts) {
      if (!rel.endsWith(".html")) continue
      for (const link of anchors(html)) {
        if (!isInternalHref(link.href)) continue
        if (/^[\x00-\x7F]*$/.test(withoutAnchor(link.href))) continue
        checked++
        assert.ok(isEncoded(link.href), `${rel} 的站内链接未编码：${link.href}`)
        assert.ok(resolveHref(files, rel, link.href), `${rel} 的站内链接解析不到产物：${link.href}`)
      }
    }
    assert.ok(checked >= 3, `应检查到面包屑/反链/文件树的中文链接，实际 ${checked} 条`)
  })

  test("深层页面的面包屑显示完整层级，并逐级指回祖先页", () => {
    assert.ok(
      plainText(deepHtml).includes("Home ❯ 别处 ❯ 更深 ❯ 深层条目"),
      "面包屑应把当前页的祖先目录连成一条可见路径",
    )

    const resolved = anchors(deepHtml)
      .filter((link) => isInternalHref(link.href))
      .map((link) => resolveHref(files, deepPage, link.href))
    for (const ancestor of ["别处/index.html", "别处/更深/index.html"]) {
      assert.ok(resolved.includes(ancestor), `面包屑应能点回 ${ancestor}`)
    }
  })

  test("深层页面的目录列出各级小节，锚点命中同页标题", () => {
    const ids = new Set([...deepHtml.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]))
    const entries = anchors(deepHtml).filter(
      (link) => link.href.startsWith("#") && link.href.length > 1,
    )
    assert.ok(entries.length >= 2, `目录应列出至少两个标题，实际 ${entries.length} 条`)

    for (const link of entries) {
      const id = decodeURIComponent(link.href.slice(1))
      assert.ok(ids.has(id), `锚点 ${link.href} 在同页找不到对应标题`)
    }
    const listed = entries.map((link) => link.text)
    for (const section of ["小节甲", "小节乙"]) {
      assert.ok(listed.includes(section), `目录应列出「${section}」，实际：${listed.join("、")}`)
    }
    assert.ok(plainText(deepHtml).includes("目录"), "页面应显示「目录」标题")
  })

  test("文件树与图谱都在页面上，数据来自同一份发布索引", () => {
    const text = plainText(deepHtml)
    assert.ok(text.includes("探索"), "页面应显示文件树（探索）")
    assert.ok(text.includes("关系图谱"), "页面应显示图谱")

    const index = artifacts.get("static/contentIndex.json")
    assert.ok(index, "缺发布索引 static/contentIndex.json")
    const data = JSON.parse(index!) as Record<string, unknown>
    for (const slug of ["别处/更深/深层条目", "别处/中层", "根条目"]) {
      assert.ok(slug in data, `发布索引里没有 ${slug}，文件树/图谱/搜索都看不到它`)
    }
  })

  test("图谱可交互：力导向布局脚本随页面一起发布", () => {
    const scripts = scriptClosure(deepPage, deepHtml)
    assert.ok(scripts.length > 0, "页面没有引用任何站点脚本")
    const interactive = scripts.filter((src) =>
      /forceSimulation|forceLink/.test(artifacts.get(src) ?? ""),
    )
    assert.ok(
      interactive.length > 0,
      `图谱的力导向布局应出自页面脚本闭包，实际检查了：${scripts.join("、")}`,
    )
  })

  test("反链排在正文之后、页脚之前，指向每一篇引用当前页的条目", () => {
    const text = plainText(deepHtml)
    const heading = text.indexOf("反向链接")
    assert.ok(heading > 0, "页面应显示「反向链接」标题")
    assert.ok(text.indexOf("见 根条目") < heading, "反链应排在正文之后")
    const footer = text.indexOf("除特别注明外")
    assert.ok(footer > heading, "反链应排在页脚之前")

    const section = deepHtml.slice(
      deepHtml.indexOf("反向链接"),
      deepHtml.indexOf('class="site-footer"'),
    )
    const sources = anchors(section).map((link) => resolveHref(files, deepPage, link.href))
    for (const source of ["别处/中层.html", "根条目.html"]) {
      assert.ok(sources.includes(source), `反链应包含 ${source}，实际：${sources.join("、")}`)
    }
  })

  test("站点搜索：页面上有中文搜索框，索引与 Ctrl/Cmd+K 绑定都在页面脚本闭包里", () => {
    assert.ok(deepHtml.includes('placeholder="搜索内容..."'), "深层页面缺搜索框")

    const scripts = scriptClosure(deepPage, deepHtml)
    assert.ok(scripts.length > 0, "页面没有引用任何站点脚本")
    const indexReaders = [
      ...inlineScripts(deepHtml),
      ...scripts.map((src) => artifacts.get(src) ?? ""),
    ].filter((code) => /contentIndex\.json/.test(code))
    assert.ok(
      indexReaders.length > 0,
      `搜索应读发布索引，实际检查了页面内联脚本与：${scripts.join("、")}`,
    )

    const bindings = scripts.filter((src) => {
      const code = artifacts.get(src) ?? ""
      return /["']k["'][^;]{0,80}(ctrlKey|metaKey)|(ctrlKey|metaKey)[^;]{0,80}["']k["']/.test(code)
    })
    assert.ok(
      bindings.length > 0,
      `Ctrl/Cmd+K 唤出搜索的绑定应出现在页面脚本闭包里，实际检查了：${scripts.join("、")}`,
    )
  })

  test("深浅色与阅读模式都可切换", () => {
    assert.match(deepHtml, /aria-label="[^"]*暗色[^"]*"/, "缺深色模式切换按钮")
    assert.match(deepHtml, /aria-label="[^"]*阅读[^"]*"/, "缺阅读模式切换按钮")
  })

  test("手机宽度可读：视口声明与窄屏排版都在产物里", () => {
    assert.match(
      deepHtml,
      /<meta name="viewport" content="width=device-width, initial-scale=1/,
      "缺移动端视口声明",
    )
    assert.match(
      pageStyles(deepPage, deepHtml),
      /@media[^{]*\(max-width:(?:600|800)px\)/,
      "页面加载的样式表没有任何窄屏适配",
    )
  })

  test("窄屏与高 DPI 下正文与代码块不横向溢出", () => {
    const css = pageStyles(deepPage, deepHtml)
    const guards: Array<[string, string, string]> = [
      ["html", "overflow-x:hidden", "整页不横向溢出"],
      ["pre", "overflow-x:auto", "代码块自己滚动而不是撑破页面"],
      [".table-container", "overflow-x:auto", "宽表格自己滚动"],
      ["img", "max-width:100%", "图片不超出正文宽度"],
      ["p", "overflow-wrap:break-word", "长串文本在正文里折行"],
      ["h1", "overflow-wrap:break-word", "长串文本在标题里折行"],
    ]
    for (const [selector, declaration, why] of guards) {
      assert.ok(
        hasRule(css, selector, declaration),
        `页面样式表缺「${why}」：${selector} { ${declaration} }`,
      )
    }
  })

  // 文件树的展开状态是客户端行为，产物里看不到渲染结果；这里只能钉住"补丁还在"：
  // 上游 explorer 的 folderDefaultState 只写 data-collapsed 属性、客户端不读，默认永远折叠，
  // 所以本站自带一段 afterDOM 脚本（quartz/components/scripts/explorer-expand.inline.ts）补默认展开。
  test("文件树默认展开目录：自带脚本补上上游只写不读的 folderDefaultState", () => {
    const html = artifacts.get("根条目.html") ?? ""
    const explorer = /<div[^>]*\bexplorer\b[^>]*>/.exec(html)?.[0]
    assert.ok(explorer, "页面里应有文件树容器")
    assert.match(explorer!, /data-collapsed="open"/, "文件树容器的默认态应声明为展开")

    const code = scriptClosure("根条目.html", html)
      .map((src) => artifacts.get(src) ?? "")
      .join("\n")
    assert.match(code, /\.explorer \.folder-container/, "缺「找出目录节点」的脚本")
    assert.match(code, /folder-outer/, "缺「把目录内容展开」的逻辑")
    assert.match(code, /fileTree/, "展开补丁应沿用 explorer 自己保存的折叠状态")
  })

  test("侧栏图谱默认给当前条目两层邻居，全局图谱仍由右上角按钮打开", () => {
    const html = artifacts.get("根条目.html") ?? ""
    const rawCfg = /<div[^>]*class="graph-container"[^>]*data-cfg="([^"]*)"/.exec(html)?.[1]
    assert.ok(rawCfg, "页面里应有局部图谱容器")
    const cfg = JSON.parse(rawCfg!.replaceAll("&quot;", '"').replaceAll("&amp;", "&"))
    assert.equal(cfg.depth, 2, "局部图谱默认深度应是 2 层邻居，而不是 1 层")
    assert.match(html, /class="global-graph-icon"/, "缺全局图谱的打开按钮")
  })

  test("产物里不存在任何第三方域名请求", async () => {
    assert.deepEqual(
      thirdPartyRequests(artifacts, await siteBaseUrl()),
      [],
      "产物仍在请求第三方资源",
    )
  })
})
