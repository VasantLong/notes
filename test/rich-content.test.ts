import { describe, test, before } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { buildSite, entry, listArtifacts, readTextArtifacts, tmpDir } from "./helpers/build.ts"
import { anchorFor, anchors, plainText, resolveHref } from "./helpers/html.ts"

/**
 * 票 08：富内容页。fixture 花园库真构建，只读产物断言「页面存在 + 关键内容出现 + 不该出现的没出现」。
 *
 * 三处断言刻意贴着产物的标记，都是「产物与前端渲染器之间的接缝」，不是 Quartz 插件的内部形状：
 * - 公式的 .katex / .katex-display 是 KaTeX 对外的 DOM 契约（KaTeX 文档里就让人按这两个类做样式），
 *   服务端渲染完成后只剩 CSS 依赖，禁用 JS 也读得出；
 * - 图的 code.mermaid 是「Markdown 转成图源」与「浏览器把它画出来」两半之间的唯一握手点，浏览器里跑不起来，
 *   这是能取到的唯一证据；
 * - 画布只断言按钮的无障碍名（Zoom in/out），不认它的类名。
 * 其余一律按行为断言：链接用「解析后命中真实产物」，脚本用「链上每一跳都能在产物里解析到」。
 */

const fixtureDir = path.join(tmpDir, "rich-content")
const contentDir = path.join(fixtureDir, "content")
const outDir = path.join(fixtureDir, "out")

const mathNote = entry(
  "publish: true\ntitle: 富内容\ndescription: 公式与图\ndate: 2026-11-16",
  [
    "行内公式 $a^2 + b^2 = c^2$ 在句中。",
    "",
    "$$",
    "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
    "$$",
    "",
    "\u0060\u0060\u0060mermaid",
    "graph TD",
    "  开始 --> 结束",
    "\u0060\u0060\u0060",
    "",
  ].join("\n"),
)

const canvasFile = JSON.stringify(
  {
    nodes: [
      {
        id: "n1",
        type: "text",
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        text: "# 画布节点标题\n\n- 列表项甲\n- 列表项乙\n\n[[内部笔记]]",
      },
      { id: "n2", type: "file", x: 500, y: 0, width: 400, height: 400, file: "内部笔记.md" },
    ],
    edges: [],
  },
  null,
  2,
)

// 条目契约只有 publish/title/description/date，看板按契约里的 date 分组，不引入 fixture 私有字段。
const baseFile = [
  "filters:",
  "  and:",
  "    - 'publish == true'",
  "views:",
  "  - type: table",
  "    name: 表格视图",
  "    order:",
  "      - file.name",
  "      - description",
  "  - type: list",
  "    name: 列表视图",
  "  - type: board",
  "    name: 看板视图",
  "    groupBy:",
  "      property: date",
  "      direction: ASC",
  "",
].join("\n")

const fixture: Record<string, string> = {
  "index.md": entry(
    "publish: true\ntitle: 首页\ndescription: 花园首页\ndate: 2026-11-16",
    "看 [[画布.canvas]] 与 [[花园.base]]。",
  ),
  "富内容.md": mathNote,
  "内部笔记.md": entry(
    "publish: true\ntitle: 内部笔记\ndescription: 一条内部笔记\ndate: 2026-11-16",
  ),
  "未列出的笔记.md": entry(
    "publish: true\nunlisted: true\ntitle: 未列出的笔记\ndescription: 隐藏条目\ndate: 2026-11-16",
    "隐藏正文。",
  ),
  "画布.canvas": canvasFile,
  "花园.base": baseFile,
}

/**
 * 产物里指向某个文件的相对/根路径引用：引号包着、以文件扩展名收尾的字面量。
 * 扩展名是必要过滤——脚本正文里的普通字符串（压缩后的表达式片段）也会以 / 开头。
 */
const quotedRefs = (content: string) =>
  [...content.matchAll(/["'`]((?:\/|\.{1,2}\/)[\w./-]*\.[a-z0-9]{2,5})["'`]/g)].map((m) => m[1])

const resolveRef = (fromFile: string, ref: string) =>
  path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), ref))

const buttonLabels = (html: string) =>
  [...html.matchAll(/<button\b[^>]*?aria-label="([^"]+)"/g)].map((m) => m[1])

describe("票 08：富内容页", () => {
  let artifacts: Map<string, string>
  let files: string[]

  before(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
    await fs.mkdir(contentDir, { recursive: true })
    for (const [name, body] of Object.entries(fixture)) {
      await fs.writeFile(path.join(contentDir, name), body)
    }
    await buildSite({ contentDir, outDir })
    artifacts = await readTextArtifacts(outDir)
    files = await listArtifacts(outDir)
  })

  test("行内与块级公式都由服务端渲染成数学标记，不靠客户端 JS", () => {
    const html = artifacts.get("富内容.html")
    assert.ok(html, "富内容页缺失：" + [...artifacts.keys()].join(", "))

    const rendered = [...html!.matchAll(/class="katex"/g)].length
    assert.ok(rendered >= 2, `数学标记应同时覆盖行内与块级公式，实际 ${rendered} 处`)
    assert.ok(html!.includes("katex-display"), "块级公式应渲染成独立展示块")

    // 服务端渲染完成：公式源码不应作为纯文本留在页面上等前端补渲染
    assert.ok(!plainText(html!).includes("$a^2 + b^2 = c^2$"), "行内公式仍是源码，说明没渲染")
    assert.ok(!plainText(html!).includes("\\int_0^1 x^2"), "块级公式仍是源码，说明没渲染")

    // 禁用 JS 仍可读：公式排版本质上只要 CSS，样式表必须是站内文件且真的在产物里
    const cssRefs = [...html!.matchAll(/<link\b[^>]*?href="([^"]*katex[^"]*)"/g)].map((m) => m[1])
    assert.ok(cssRefs.length > 0, "页面没有引用 KaTeX 样式表，公式在无 JS 环境下会退化成裸文本")
    for (const ref of cssRefs) {
      const target = resolveRef("富内容.html", ref)
      assert.ok(files.includes(target), `公式样式表 ${ref} 不在产物里`)
    }
  })

  test("mermaid 图源留在页面上，浏览器要的运行时从站点自托管加载", () => {
    const html = artifacts.get("富内容.html")
    assert.ok(html, "富内容页缺失：" + [...artifacts.keys()].join(", "))
    assert.ok(html!.includes('class="mermaid"'), "mermaid 代码块应被标记成图，交给浏览器渲染")
    assert.ok(html!.includes("graph TD"), "图源应保留在产物里")

    // 前端拿到的必须是本地入口，而且脚本链上每一跳都能在产物里解析到（缺一跳浏览器就 404）
    const entryRefs = [...artifacts].flatMap(([name, content]) =>
      quotedRefs(content)
        .filter((ref) => ref.includes("mermaid"))
        .map((ref) => ({ name, ref })),
    )
    assert.ok(entryRefs.length > 0, "页面脚本没有引用自托管的 mermaid 运行时")
    for (const { name, ref } of entryRefs) {
      const target = ref.startsWith("/") ? ref.slice(1) : resolveRef(name, ref)
      assert.ok(files.includes(target), `${name} 引用的 ${ref} 不在产物里`)
      for (const hop of quotedRefs(artifacts.get(target) ?? "")) {
        const resolved = resolveRef(target, hop)
        assert.ok(files.includes(resolved), `${target} 引用的 ${hop} 不在产物里`)
      }
    }
  })

  test(".canvas 产出画布页，节点里的标题、列表、链接照常渲染", () => {
    const html = artifacts.get("画布.canvas.html")
    assert.ok(html, ".canvas 没有产出页面：" + [...artifacts.keys()].join(", "))

    const text = plainText(html!)
    assert.ok(text.includes("画布节点标题"), "节点里的标题没渲染")
    assert.ok(text.includes("列表项甲") && text.includes("列表项乙"), "节点里的列表没渲染")

    const link = anchorFor(anchors(html!), "内部笔记")
    assert.ok(link, "节点里的双链没渲染成链接")
    const target = resolveHref(files, "画布.canvas.html", link!.href)
    assert.ok(target, `画布里的链接 ${link!.href} 解析不到产物`)
    assert.ok(artifacts.has(target!), "链接落点应是真实页面")

    // 平移缩放靠浏览器交互，画布页至少要给出缩放控件的无障碍入口
    const labels = buttonLabels(html!)
    assert.ok(labels.includes("Zoom in"), "画布页缺放大控件：" + labels.join(", "))
    assert.ok(labels.includes("Zoom out"), "画布页缺缩小控件：" + labels.join(", "))
  })

  test(".base 产出表格、列表、看板三视图，数据取自花园库条目", () => {
    const html = artifacts.get("花园.base.html")
    assert.ok(html, ".base 没有产出页面：" + [...artifacts.keys()].join(", "))

    const text = plainText(html!)
    for (const view of ["表格视图", "列表视图", "看板视图"]) {
      assert.ok(text.includes(view), `缺视图：${view}`)
    }
    assert.ok(text.includes("一条内部笔记"), "视图里应出现条目的描述字段")
  })

  test("未列出的页面不出现在 Bases 视图里", () => {
    const html = artifacts.get("花园.base.html")
    assert.ok(html, ".base 没有产出页面：" + [...artifacts.keys()].join(", "))

    const text = plainText(html!)
    assert.ok(!text.includes("未列出的笔记"), "未列出页面的标题漏进了 Bases 视图")
    assert.ok(!text.includes("隐藏条目"), "未列出页面的描述漏进了 Bases 视图")
  })
})
