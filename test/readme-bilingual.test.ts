import { describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { repoRoot } from "./helpers/build"

const read = (rel: string) => fs.readFile(path.join(repoRoot, rel), "utf8")

/** README 是门面，运维细节与内容流程各有真相源；这三份文件的边界由本文件钉住。 */
describe("README：双语，且不兼任运维手册", () => {
  test("中英两份 README 互链，都指向同一套文档", async () => {
    const [en, zh] = await Promise.all([read("README.md"), read("README.zh-CN.md")])
    assert.match(en, /README\.zh-CN\.md/, "英文 README 应链到中文版")
    assert.match(zh, /\]\(README\.md\)/, "中文 README 应链回英文版")

    for (const [name, text] of [
      ["README.md", en],
      ["README.zh-CN.md", zh],
    ] as const) {
      for (const target of [
        "https://notes.vasantlong.de5.net",
        "docs/content.md",
        "docs/deploy.md",
        "AGENTS.md",
        "CONTEXT.md",
        "DEGRADATIONS.md",
      ]) {
        assert.ok(text.includes(target), `${name} 缺入口 ${target}`)
      }
    }
  })

  test("README 不夹带运维细节，那些在 docs/deploy.md 与 docs/content.md", async () => {
    const [en, zh, deploy, content] = await Promise.all([
      read("README.md"),
      read("README.zh-CN.md"),
      read("docs/deploy.md"),
      read("docs/content.md"),
    ])

    // 这些串只该出现在运维/内容文档里；README 一旦出现，说明又开始杂糅了
    const opsOnly = ["deploy.yml", "fetch-depth", "PUT /repos/", "buildQuartz is not a function"]
    for (const [name, text] of [
      ["README.md", en],
      ["README.zh-CN.md", zh],
    ] as const) {
      for (const marker of opsOnly) {
        assert.ok(!text.includes(marker), `${name} 出现运维细节 ${marker}，应搬到 docs/deploy.md`)
      }
    }

    assert.match(deploy, /deploy\.yml/, "docs/deploy.md 应是 CI 与部署的真相源")
    assert.match(deploy, /fetch-depth/, "docs/deploy.md 应写清全量历史要求")
    assert.match(content, /`publish`/, "docs/content.md 应写清条目四字段")
    assert.match(content, /`description`/, "docs/content.md 应写清描述字段的约束")
    assert.match(content, /check:entries/, "docs/content.md 应给出校验命令")
  })

  test("AGENTS.md 收录本仓最容易踩的坑", async () => {
    const agents = await read("AGENTS.md")
    for (const marker of [
      "check:entries",
      "tmp/",
      "--test-concurrency",
      "folderDefaultState",
      "contentIndex",
    ]) {
      assert.ok(agents.includes(marker), `AGENTS.md 缺 ${marker}`)
    }
  })
})
