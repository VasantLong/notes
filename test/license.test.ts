import { before, describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { buildSite, listArtifacts, readTextArtifacts, repoRoot, tmpDir } from "./helpers/build"
import { anchors, plainText, resolveHref } from "./helpers/html"

const outDir = path.join(tmpDir, "license", "public")

describe("内容许可：页脚标注 + 许可条目", () => {
  let files: string[]
  let artifacts: Map<string, string>

  before(async () => {
    await buildSite({ contentDir: path.join(repoRoot, "content"), outDir })
    files = await listArtifacts(outDir)
    artifacts = await readTextArtifacts(outDir)
  })

  test("每个页面的页脚都标注内容许可，并链到许可条目", () => {
    const pages = ["index.html", "这座花园是什么.html", "党团/入党教材.html", "license.html"]
    for (const page of pages) {
      const html = artifacts.get(page)
      assert.ok(html, `真实产物缺 ${page}`)
      assert.match(plainText(html!), /CC BY 4\.0/, `${page} 页脚没有 CC BY 4.0`)

      const link = anchors(html!).find((anchor) => {
        // 页脚 message 是原样 HTML：站点根绝对路径（/license）在浏览器里按站点根解析，
        // 而 resolveHref 只做相对解析，所以这里先把前导 / 换成从首页出发。
        const target = anchor.href.startsWith("/")
          ? resolveHref(files, "index.html", anchor.href.slice(1))
          : resolveHref(files, page, anchor.href)
        return target === "license.html"
      })
      assert.ok(link, `${page} 页脚的许可链接解析不到 license.html`)
    }
  })

  test("许可条目写清内容与代码两套许可", () => {
    const html = artifacts.get("license.html")
    assert.ok(html, "缺 license.html")
    const text = plainText(html!)
    assert.match(text, /CC BY 4\.0/, "许可条目应写明内容许可")
    assert.match(text, /MIT/, "许可条目应写明代码许可")
  })

  test("中英 README 的许可口径一致", async () => {
    for (const rel of ["README.md", "README.zh-CN.md"]) {
      const text = await fs.readFile(path.join(repoRoot, rel), "utf8")
      assert.match(text, /CC BY 4\.0/, `${rel} 应写明内容许可`)
      assert.match(text, /MIT/, `${rel} 应写明代码许可`)
    }
  })
})
