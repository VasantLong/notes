import { describe, test, before } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { parse as parseYaml } from "yaml"
import {
  buildSite,
  listArtifacts,
  readTextArtifacts,
  repoRoot,
  siteBaseUrl,
  thirdPartyRequests,
  tmpDir,
} from "./helpers/build.ts"

const contentDir = path.join(repoRoot, "content")
const outDir = path.join(tmpDir, "skeleton")

describe("站点骨架：配置契约", () => {
  test("quartz.config.yaml 与规格里的配置表逐条一致", async () => {
    const raw = await fs.readFile(path.join(repoRoot, "quartz.config.yaml"), "utf8")
    const config = parseYaml(raw)
    const c = config.configuration

    assert.equal(c.baseUrl, "notes.vasantlong.de5.net")
    assert.equal(c.locale, "zh-CN")
    assert.equal(c.analytics, null)
    assert.equal(c.enableSPA, true)
    assert.equal(c.enablePopovers, true)
    assert.equal(c.publishAssets, "referenced")
    assert.equal(c.links.markdownLinkResolution, "shortest")
    assert.equal(c.links.disableBrokenWikilinks, true)
    assert.equal(c.contentIndex.enableSiteMap, true)
    assert.equal(c.contentIndex.enableRSS, false)
    assert.equal(c.drafts.publish, false)
    assert.equal(c.theme.fontOrigin, "local")
    assert.equal(c.theme.cdnCaching, false)
    assert.ok(c.pageTitle, "pageTitle 必须非空")
    for (const pattern of ["private", "templates", ".obsidian", "inbox"]) {
      assert.ok(c.ignorePatterns.includes(pattern), `ignorePatterns 缺 ${pattern}`)
    }
  })

  test("字体不再走 Google Fonts", async () => {
    const raw = await fs.readFile(path.join(repoRoot, "quartz.config.yaml"), "utf8")
    const config = parseYaml(raw)
    const fonts = config.plugins.find(
      (p: { source: string }) => p.source === "@quartz-community/quartz-fonts",
    )
    assert.ok(fonts, "字体插件必须在配置里")
    assert.equal(fonts.enabled, true)
    // 插件默认就是 googleFonts：写成「不等于 googleFonts」在选项缺失时会假通过。
    assert.equal(fonts.options?.fontOrigin, "local")
  })

  test("插件矩阵与规格一致", async () => {
    const raw = await fs.readFile(path.join(repoRoot, "quartz.config.yaml"), "utf8")
    const config = parseYaml(raw)
    const state = new Map<string, boolean>(
      config.plugins.map((p: { source: string; enabled?: boolean }) => [
        p.source,
        p.enabled !== false,
      ]),
    )
    const mustBeOn = [
      "explicit-publish",
      "bases-page",
      "canvas-page",
      "note-properties",
      "alias-redirects",
      "backlinks",
      "graph",
      "explorer",
      "search",
      "table-of-contents",
      "latex",
      "obsidian-flavored-markdown",
      "github-flavored-markdown",
      "syntax-highlighting",
      "breadcrumbs",
      "darkmode",
      "reader-mode",
      "article-title",
      "page-title",
      "description",
      "content-meta",
      "created-modified-date",
      "favicon",
      "cname",
      "footer",
      "spacer",
      "unlisted-pages",
      "tag-list",
    ]
    const mustBeOff = [
      "encrypted-pages",
      "og-image",
      "comments",
      "citations",
      "roam",
      "ox-hugo",
      "recent-notes",
      "stacked-pages",
    ]
    for (const name of mustBeOn) {
      assert.equal(state.get("@quartz-community/" + name), true, `${name} 应开启`)
    }
    for (const name of mustBeOff) {
      assert.equal(state.get("@quartz-community/" + name), false, `${name} 应显式关闭`)
    }
  })

  test("插件版本被锁死：精确版本 + 锁文件条目", async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"))
    const lock = JSON.parse(await fs.readFile(path.join(repoRoot, "package-lock.json"), "utf8"))
    const pluginDeps = Object.entries(pkg.dependencies).filter(([name]) =>
      name.startsWith("@quartz-community/"),
    )
    assert.ok(pluginDeps.length > 0)
    for (const [name, range] of pluginDeps) {
      assert.match(String(range), /^\d+\.\d+\.\d+$/, `${name} 必须精确锁定，不能是 ${range}`)
      const locked = lock.packages[`node_modules/${name}`]
      assert.ok(locked, `锁文件缺 ${name}`)
      assert.equal(locked.version, range, `${name} 锁文件版本与 package.json 不一致`)
      assert.ok(locked.resolved && locked.integrity, `${name} 缺 resolved/integrity`)
    }
  })
})

describe("站点骨架：构建产物", () => {
  let artifacts: Map<string, string>
  let files: string[]

  before(async () => {
    await buildSite({ contentDir, outDir })
    artifacts = await readTextArtifacts(outDir)
    files = await listArtifacts(outDir)
  })

  test("条目构建出 HTML，页面标题取自 frontmatter", async () => {
    const entrySource = await fs.readFile(path.join(contentDir, "这座花园是什么.md"), "utf8")
    const title = /^title:\s*(.+)$/m.exec(entrySource)?.[1]?.trim()
    assert.ok(title, "真实条目必须带 title")
    const html = [...artifacts.entries()].find(
      ([name]) => name.endsWith(".html") && name.includes("这座花园是什么"),
    )
    assert.ok(html, "条目没有对应 HTML：" + [...artifacts.keys()].join(", "))
    assert.ok(html[1].includes(`<title>${title}</title>`), "页面标题应来自 frontmatter")
  })

  test("locale zh-CN 落到 html lang 与界面文案", async () => {
    const html = artifacts.get("这座花园是什么.html")
    assert.ok(html, "缺条目 HTML")
    // Quartz 把 locale 的语种部分写进 lang（zh-CN → zh）
    assert.match(html!, /<html[^>]*lang="zh"/)
    assert.ok(html!.includes(`placeholder="搜索内容..."`), "界面文案应该是中文")
  })

  test("产物里不存在任何第三方域名请求", async () => {
    assert.deepEqual(
      thirdPartyRequests(artifacts, await siteBaseUrl()),
      [],
      "产物仍在请求第三方资源",
    )
  })

  test("第三方库改为自托管，且本地文件齐全", async () => {
    const required = [
      "static/vendor/d3.min.js",
      "static/vendor/pixi.min.js",
      "static/vendor/katex/katex.min.css",
      // mermaid 运行时与它的载入器薄壳（图渲染脚本 import 的就是这个载入器，别再指回 cdnjs）
      "static/mermaid-loader.js",
      "static/vendor/mermaid/mermaid.min.js",
    ]
    for (const rel of required) {
      assert.ok(files.includes(rel), `缺自托管资源 ${rel}`)
    }
    const katexCss = await fs.readFile(
      path.join(outDir, "static/vendor/katex/katex.min.css"),
      "utf8",
    )
    const localRefs = [...katexCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1])
    assert.ok(localRefs.length > 0, "KaTeX CSS 应该引用字体文件")
    for (const ref of localRefs) {
      assert.ok(!/^(https?:)?\/\//.test(ref), `KaTeX CSS 仍引用远程字体 ${ref}`)
      const resolved = path.posix.normalize(path.posix.join("static/vendor/katex", ref))
      assert.ok(files.includes(resolved), `KaTeX CSS 引用的字体不存在：${resolved}`)
    }
  })
})
