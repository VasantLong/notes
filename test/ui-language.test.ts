import { describe, test, before } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { parse as parseYaml } from "yaml"
import { buildSite, listArtifacts, readTextArtifacts, repoRoot, tmpDir } from "./helpers/build.ts"
import { buildUiI18n } from "../quartz/ui-i18n/build-dict.ts"
import { uiI18n } from "../quartz/ui-i18n.generated.ts"

const contentDir = path.join(repoRoot, "content")
const outDir = path.join(tmpDir, "ui-language")

describe("界面语言层与站脚：产物契约", () => {
  let artifacts: Map<string, string>

  before(async () => {
    await buildSite({ contentDir, outDir })
    artifacts = await readTextArtifacts(outDir)
  })

  test("顶栏带中/EN 切换器，首帧前写好 data-ui-lang", async () => {
    const html = artifacts.get("index.html")
    assert.ok(html, "缺 index.html")
    assert.match(html, /data-ui-lang-btn="zh"/, "顶栏缺中文按钮")
    assert.match(html, /data-ui-lang-btn="en"/, "顶栏缺英文按钮")
    // 显隐规则跟着组件 CSS 走，不在 HTML 里
    const css = [...artifacts]
      .filter(([rel]) => rel.endsWith(".css"))
      .map(([, text]) => text)
      .join("\n")
    assert.match(
      css,
      /html:not\(\[data-ui-lang=en\]\) \[data-ui-en\]/,
      "缺双语显隐规则（无 JS 时中文文案会被英文重复）",
    )
    assert.match(css, /html\[data-ui-lang=en\] \[data-ui-zh\]/, "缺英文态隐藏中文的规则")

    const prescripts = [...artifacts].filter(([rel]) => /^prescript-.*\.js$/.test(rel))
    assert.ok(prescripts.length > 0, "缺 head 同步脚本")
    const boot = prescripts.map(([, text]) => text).join("\n")
    assert.match(boot, /__UI_I18N__/, "字典没进 head 同步脚本")
    assert.match(boot, /data-ui-lang/, "引导脚本没写 data-ui-lang")
  })

  test("引擎脚本在产物里，且只替换界面文案", async () => {
    const engine = [...artifacts]
      .filter(([rel]) => /^static\/scripts\/script-\d+.*\.js$/.test(rel))
      .map(([, text]) => text)
      .filter((text) => text.includes("data-ui-lang-btn"))
    assert.equal(engine.length, 1, `引擎脚本应恰好一份，实际 ${engine.length} 份`)
    assert.match(engine[0], /markdown-preview-view/, "正文必须留在跳过列表里")
    assert.match(engine[0], /article-title/, "笔记标题必须留在跳过列表里")
  })

  test("字典是生成物，且覆盖插件自带词表", async () => {
    assert.deepEqual(
      buildUiI18n().dict,
      uiI18n,
      "quartz/ui-i18n.generated.ts 与生成器不一致，跑 npm run gen:ui-dict",
    )

    const values = Object.values(uiI18n.strings)
    assert.ok(values.includes("Table of Contents"), "缺右栏目录译文")
    // 站点标题已是 notes（英文原文），左栏不需要译文；改名前的「花园 → Garden」已删
    assert.ok(values.includes("Search for something..."), "缺搜索框占位符译文")
    assert.ok(
      uiI18n.patterns.some(
        (p) => p.one === "$1 item with this tag." && p.other === "$1 items with this tag.",
      ),
      "缺「N 条笔记」的单复数模式",
    )
    assert.ok(
      uiI18n.patterns.some((p) => p.re === "^(\\d+)分钟阅读$" && p.en === "$1 min read"),
      "缺「N 分钟阅读」的插值模式",
    )
  })

  test("站脚是标准两行：版权行 + 许可声明，双语并置", async () => {
    for (const page of ["index.html", "404.html"]) {
      const html = artifacts.get(page)
      assert.ok(html, `缺 ${page}`)
      assert.match(html, /<footer class="site-footer" data-site-footer/, `${page} 缺站脚`)
      assert.match(html, /© \d{4} Vasant Long/, `${page} 缺版权行`)
      assert.match(
        html,
        /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//,
        `${page} 的站脚没链到 CC BY 4.0`,
      )
      assert.match(html, /blob\/main\/LICENSE\.txt/, `${page} 的站脚没链到代码许可`)
      assert.match(html, /data-ui-zh/, `${page} 的站脚缺中文文案`)
      assert.match(html, /data-ui-en/, `${page} 的站脚缺英文文案`)
    }
  })

  test("页面不再出现 Quartz 默认页脚", async () => {
    const offenders = [...artifacts].filter(([, text]) => text.includes("Created with Quartz"))
    assert.deepEqual(
      offenders.map(([rel]) => rel),
      [],
      "仍有页面在用 @quartz-community/footer 的默认页脚",
    )
  })

  test("每个页面只有一个站脚，配置里也不再挂 footer 插件", async () => {
    const pages = [...artifacts].filter(([rel]) => rel.endsWith(".html"))
    let checked = 0
    for (const [rel, html] of pages) {
      // 别名页是 meta refresh 跳转桩，不渲染任何 chrome
      if (html.includes('http-equiv="refresh"')) continue
      checked += 1
      assert.equal(html.split('class="site-footer"').length - 1, 1, `${rel} 的站脚数量不是 1`)
    }
    assert.ok(checked > 0, "没检查到任何页面")

    const raw = await fs.readFile(path.join(repoRoot, "quartz.config.yaml"), "utf8")
    const config = parseYaml(raw)
    const footerPlugin = config.plugins.find(
      (p: { source: string }) => p.source === "@quartz-community/footer",
    )
    assert.equal(footerPlugin, undefined, "footer 插件仍在配置里，页脚会重复渲染")
  })

  test("站脚链接指向真实产物", async () => {
    const names = await listArtifacts(outDir)
    assert.ok(names.includes("license.html"), "缺 /license 页")
    const html = artifacts.get("index.html")
    assert.ok(html, "缺 index.html")
    assert.match(html, /href="\.\/license"/, "首页站脚的许可链接没指向 /license")
  })
})
