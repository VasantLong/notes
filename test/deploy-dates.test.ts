import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import fs from "node:fs/promises"
import { parse as parseYaml } from "yaml"
import { buildSite, entry, repoRoot, tmpDir } from "./helpers/build.ts"

/**
 * 票 10 的第二条接缝：构建产物里的日期。
 *
 * CI 里常见的坏形状是"干净机器 checkout + 文件系统 mtime = 全部条目都是今天"。
 * 这里用真实 git 仓复现那个形状（提交时间是 2001，mtime 是现在），只断言产物页上
 * 显示的日期——不碰插件内部。
 *
 * 注意边界：条目契约要求已发布条目自带 date，而 normalizeFrontmatter 让
 * modified 继承 date，所以今天页面上显示的日期恒等于前置字段，git 时间轮不到。
 * 浅克隆因此没有可观察的差异，也就没有对应的行为测试——deploy.yml 的
 * fetch-depth: 0 是"将来放开 date 必填"时的保险，不是今天被测住的行为。
 */

const run = promisify(execFile)

const git = async (cwd: string, args: string[], env: Record<string, string> = {}) => {
  await run("git", args, { cwd, env: { ...process.env, ...env } })
}

const ENTRY_NAME = "旧条目.md"
const FRONTMATTER_DATE = "2019-05-06"

/** 花园库放在临时 git 仓里：提交时间与 mtime 故意不一致，日期只能有一个真相源。 */
const makeVault = async (name: string): Promise<string> => {
  const dir = path.join(tmpDir, "dates", name)
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, ENTRY_NAME),
    entry(
      [
        "publish: true",
        "title: 旧条目",
        "description: 日期来自 git 与前置字段，而不是文件系统",
        "date: " + FRONTMATTER_DATE,
      ].join("\n"),
    ),
  )
  await git(dir, ["init", "-q"])
  await git(dir, ["add", "-A"])
  await git(
    dir,
    ["-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "旧条目"],
    { GIT_AUTHOR_DATE: "2001-02-03T04:05:06Z", GIT_COMMITTER_DATE: "2001-02-03T04:05:06Z" },
  )
  // 干净机器 checkout 的形状：文件刚落地，mtime 就是现在。
  const now = new Date()
  await fs.utimes(path.join(dir, ENTRY_NAME), now, now)
  return dir
}

const dateShown = async (outDir: string): Promise<string> => {
  const files = await fs.readdir(outDir, { recursive: true })
  const page = files.find((file) => file.endsWith("旧条目.html"))
  assert.ok(page, "产物里应有旧条目.html，实际：" + files.join(", "))
  const html = await fs.readFile(path.join(outDir, page), "utf8")
  const match = /<time datetime="([^"]+)"/.exec(html)
  assert.ok(match, "页面应显示一个日期")
  return match[1]
}

/** 产物里的 datetime 是 UTC，日期断言按构建机本地日历口径比较。 */
const localDate = (value: string): string => {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

const today = () => new Date().toISOString().slice(0, 10)

describe("CI：日期不来自文件系统", () => {
  test("前置字段的日期压过 mtime：产物显示 2019，不是今天", async () => {
    const vault = await makeVault("full")
    const outDir = path.join(tmpDir, "dates", "out-full")
    await buildSite({ contentDir: vault, outDir })

    const shown = localDate(await dateShown(outDir))
    assert.equal(shown, FRONTMATTER_DATE, "日期应来自前置字段，实际 " + shown)
    assert.notEqual(shown, today(), "日期回落到了 mtime（今天）")
  })

  test("配置里 git 排在 filesystem 之前：前置字段缺失时才轮到历史", async () => {
    const config = parseYaml(await fs.readFile(path.join(repoRoot, "quartz.config.yaml"), "utf8"))
    const plugin = config.plugins.find(
      (p: { source: string }) => p.source === "@quartz-community/created-modified-date",
    )
    assert.ok(plugin, "created-modified-date 插件必须在配置里")
    assert.deepEqual(plugin.options?.priority, ["frontmatter", "git", "filesystem"])
  })
})
