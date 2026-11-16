import { describe, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import {
  DESCRIPTION_MAX_LENGTH,
  validateEntry,
  type EntryViolation,
} from "../quartz/util/entry-contract"

const repoRoot = path.resolve(import.meta.dirname, "..")

const valid = {
  publish: true,
  title: "这座花园是什么",
  description: "一个只写自己踩过的坑的花园。",
  date: "2026-11-16",
}

const fields = (violations: EntryViolation[]) => violations.map((v) => v.field)

describe("条目契约校验器（纯函数）", () => {
  test("合法条目没有违规", () => {
    assert.deepEqual(validateEntry(valid, "index"), [])
  })

  test("缺 title", () => {
    const { title: _omit, ...rest } = valid
    assert.deepEqual(fields(validateEntry(rest, "a")), ["title"])
  })

  test("缺 description", () => {
    const { description: _omit, ...rest } = valid
    assert.deepEqual(fields(validateEntry(rest, "a")), ["description"])
  })

  test("description 超过 80 字", () => {
    const tooLong = { ...valid, description: "花".repeat(DESCRIPTION_MAX_LENGTH + 1) }
    assert.deepEqual(fields(validateEntry(tooLong, "a")), ["description"])
    const exact = { ...valid, description: "花".repeat(DESCRIPTION_MAX_LENGTH) }
    assert.deepEqual(validateEntry(exact, "a"), [])
  })

  test('publish 是字符串 "true" 判违规', () => {
    assert.deepEqual(fields(validateEntry({ ...valid, publish: "true" }, "a")), ["publish"])
  })

  test("publish 为假值判违规", () => {
    assert.deepEqual(fields(validateEntry({ ...valid, publish: false }, "a")), ["publish"])
  })

  test("没写 publish 的笔记不算条目：校验器放行（构建期让它「不存在」）", () => {
    const { publish: _omit, ...rest } = valid
    assert.deepEqual(validateEntry(rest, "半截笔记"), [])
    assert.deepEqual(validateEntry({ title: "只有标题" }, "半截笔记"), [])
  })

  test("缺 date", () => {
    const { date: _omit, ...rest } = valid
    assert.deepEqual(fields(validateEntry(rest, "a")), ["date"])
  })

  test("date 不可解析", () => {
    assert.deepEqual(fields(validateEntry({ ...valid, date: "去年某天" }, "a")), ["date"])
  })

  test("date 是 YAML 解析出的 Date 对象也算可解析", () => {
    assert.deepEqual(validateEntry({ ...valid, date: new Date("2026-11-16") }, "a"), [])
    assert.deepEqual(fields(validateEntry({ ...valid, date: new Date("nope") }, "a")), ["date"])
  })

  test("同一输入多次运行输出完全一致（顺序稳定）", () => {
    const broken = { publish: "true", title: "", description: "", date: "???" }
    const first = validateEntry(broken, "a")
    assert.deepEqual(fields(first), ["publish", "title", "description", "date"])
    for (let i = 0; i < 5; i++) assert.deepEqual(validateEntry(broken, "a"), first)
  })

  test("不判定发布态：draft 与 publish 同时为真时校验器放行", () => {
    assert.deepEqual(validateEntry({ ...valid, draft: true }, "a"), [])
  })
})

const runCli = async (dir: string) => {
  return spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    ["scripts/check-entries.ts", "--dir", dir],
    { cwd: repoRoot, encoding: "utf8" },
  )
}

describe("条目契约 CLI", () => {
  const tmpRoot = path.join(os.tmpdir(), "notes-garden-tests", "entry-contract")

  const writeVault = async (name: string, files: Record<string, string>) => {
    const dir = path.join(tmpRoot, name)
    await fs.rm(dir, { recursive: true, force: true })
    await fs.mkdir(dir, { recursive: true })
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, rel)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, body, "utf8")
    }
    return dir
  }

  test("坏条目：指出文件与字段并以非 0 退出", async () => {
    const dir = await writeVault("bad", {
      "好条目.md": `---
publish: true
title: 好条目
description: 一个合法条目。
date: 2026-11-16
---
`,
      "坏条目.md": `---
publish: "true"
title: 坏条目
description: 缺了合法的 publish。
date: 2026-11-16
---
`,
    })
    const result = await runCli(dir)
    assert.notEqual(result.status, 0, "有违规必须以非 0 退出")
    const out = result.stdout + result.stderr
    assert.match(out, /坏条目\.md/)
    assert.match(out, /publish/)
    assert.doesNotMatch(out, /好条目\.md/)
  })

  test("全部合法：以 0 退出", async () => {
    const dir = await writeVault("good", {
      "a.md": `---
publish: true
title: A
description: 合法条目。
date: 2026-11-16
---
`,
    })
    const result = await runCli(dir)
    assert.equal(
      result.status,
      0,
      `应退出 0，实际 ${result.status}: ${result.stdout}${result.stderr}`,
    )
  })

  test("跳过永不发布的目录（private/templates/inbox）与点文件", async () => {
    const dir = await writeVault("skipped", {
      "private/秘密.md": "---\ntitle: 没字段\n---\n",
      "templates/模板.md": "---\ntitle: 模板\n---\n",
      "inbox/待读.md": "---\ntitle: 待读\n---\n",
      ".obsidian/x.md": "---\ntitle: x\n---\n",
      "ok.md": `---
publish: true
title: OK
description: 合法条目。
date: 2026-11-16
---
`,
    })
    const result = await runCli(dir)
    assert.equal(
      result.status,
      0,
      `应退出 0，实际 ${result.status}: ${result.stdout}${result.stderr}`,
    )
  })
})
