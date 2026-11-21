import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { repoRoot, tmpDir } from "./helpers/build"

const exec = promisify(execFile)
const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx")
const script = path.join(repoRoot, "scripts/promote.ts")

const root = path.join(tmpDir, "promote")
const vault = path.join(root, "vault")
const dest = path.join(root, "content")

const put = async (base: string, rel: string, text: string, mtime?: Date) => {
  const abs = path.join(base, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, text)
  if (mtime) await fs.utimes(abs, mtime, mtime)
}

const read = (base: string, rel: string) => fs.readFile(path.join(base, rel), "utf8")

type Result = { code: number; out: string }

const promote = async (args: string[]): Promise<Result> => {
  try {
    const { stdout } = await exec(tsx, [script, ...args], {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
    })
    return { code: 0, out: stdout }
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string }
    return { code: e.code ?? -1, out: (e.stdout ?? "") + (e.stderr ?? "") }
  }
}

const reset = async () => {
  await fs.rm(root, { recursive: true, force: true })
  await fs.mkdir(vault, { recursive: true })
  await fs.mkdir(dest, { recursive: true })
}

/** 取出写入文件的 YAML 行，按 "key: value" 读——只断言契约字段，不锁序列化细节。 */
const frontmatterLines = (text: string): string[] => {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  assert.ok(match, "晋升后的文件缺 frontmatter")
  return match![1].split("\n")
}

describe("晋升脚本：vault → 花园库", () => {
  test("保留目录结构、补齐四字段、跳过空文件", async () => {
    await reset()
    const mtime = new Date(2026, 10, 15, 10, 30)
    await put(vault, "甲.md", "第一段。\n", mtime)
    await put(vault, "子/2乙.md", "乙的正文。\n", mtime)
    await put(vault, "空.md", "\n\n")

    const result = await promote(["--from", vault, "--to", dest])
    assert.equal(result.code, 1, "有 description 待补时应以 1 退出：" + result.out)
    assert.match(result.out, /空\.md[^\n]*empty|empty[^\n]*空\.md/, "空文件应被跳过并报告")

    const jia = await read(dest, "甲.md")
    const lines = frontmatterLines(jia)
    assert.ok(lines.includes("publish: true"), "应写入 publish: true")
    assert.ok(lines.includes("title: 甲"), "title 应取文件名")
    assert.ok(
      lines.some((l) => /^description:\s*$/.test(l) || l === 'description: ""'),
      "description 留空待补",
    )
    assert.ok(lines.includes("date: 2026-11-15"), "date 应取源文件 mtime：" + lines.join(" | "))
    assert.match(jia, /\n第一段。/, "正文应原样保留")

    const yi = await read(dest, "子/2乙.md")
    assert.ok(frontmatterLines(yi).includes("title: 乙"), "标题应去掉章节序号前缀")
    await assert.rejects(fs.stat(path.join(dest, "空.md")), "空文件不该进花园库")
  })

  test("description 从映射表取，标签合并去重，别名保留", async () => {
    await reset()
    await put(
      vault,
      "二号.md",
      ["---", "tags:", "  - 党", "aliases:", "  - 别名甲", "---", "", "正文。", ""].join("\n"),
    )
    const map = path.join(root, "descriptions.json")
    await fs.writeFile(map, JSON.stringify({ "二号.md": "一句话说明这条讲什么。" }))

    const result = await promote([
      "--from",
      vault,
      "--to",
      dest,
      "--tag",
      "党团",
      "--descriptions",
      map,
    ])
    assert.equal(result.code, 0, "字段齐全时应以 0 退出：" + result.out)

    const text = await read(dest, "二号.md")
    const lines = frontmatterLines(text)
    assert.ok(lines.includes("description: 一句话说明这条讲什么。"), "description 应来自映射表")
    assert.ok(
      lines.includes("  - 党团") && lines.includes("  - 党"),
      "标签应合并且保留原有：" + lines.join(" | "),
    )
    assert.ok(lines.includes("  - 别名甲"), "别名应保留")
    assert.equal(lines.filter((l) => l === "  - 党团").length, 1, "标签不该重复")
  })

  test("目标已存在时不覆盖，--force 才改写", async () => {
    await reset()
    await put(vault, "三号.md", "新的正文。\n")
    await put(dest, "三号.md", "旧内容")

    const blocked = await promote(["--from", vault, "--to", dest])
    assert.equal(blocked.code, 3, "冲突应以 3 退出：" + blocked.out)
    assert.match(blocked.out, /三号\.md[^\n]*conflict|conflict[^\n]*三号\.md/)
    assert.equal(await read(dest, "三号.md"), "旧内容", "未加 --force 时不该覆盖")

    const forced = await promote(["--from", vault, "--to", dest, "--force"])
    assert.notEqual(forced.code, 3)
    assert.match(await read(dest, "三号.md"), /新的正文。/)
  })
})
