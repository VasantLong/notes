#!/usr/bin/env tsx
/**
 * 晋升脚本：把 Obsidian vault 里的笔记搬进花园库，补齐条目契约的四字段骨架。
 *
 * 用法：
 *   npx tsx scripts/promote.ts --from <vault 目录> --to <content 子目录> [选项]
 *
 * 选项：
 *   --tag <标签>            可重复；写入 frontmatter tags 的最前面（原标签保留）
 *   --descriptions <json>   映射表 { "相对路径": "描述" }；缺省时 description 留空待补
 *   --force                 目标已存在时覆盖
 *   --dry-run               只打印计划，不写文件
 *
 * 退出码：
 *   0  全部写入且 description 齐全
 *   1  已写入，但有 description 待补（补齐后跑 npm run check:entries）
 *   2  用法错误（缺参数 / 目录不存在 / 映射表损坏）
 *   3  有目标已存在且未加 --force（这些文件未被改写）
 */
import { readFileSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

import matter from "gray-matter"

export interface PromoteOptions {
  from: string
  to: string
  tags: string[]
  descriptions: Record<string, string>
  force: boolean
  dryRun: boolean
}

export interface PromotePlanItem {
  relativePath: string
  text: string
  description: string
}

export interface PromotePlan {
  writes: PromotePlanItem[]
  empty: string[]
}

const pad = (value: number) => String(value).padStart(2, "0")

/** 日期取本地时区：mtime 在 UTC 边界上不会把条目挪到前一天。 */
export const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** 章节文件名带序号前缀（`2理论.md`），标题里去掉它——序号只用来排序。 */
export const titleFromPath = (relativePath: string): string =>
  path.basename(relativePath, path.extname(relativePath)).replace(/^\d+/, "").trim()

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : []

/** 生成一条条目：保留原 frontmatter 的 tags / aliases，正文原样。 */
export function buildEntry(input: {
  relativePath: string
  raw: string
  mtime: Date
  description?: string
  tags: string[]
}): { text: string; description: string } {
  const parsed = matter(input.raw)
  const body = parsed.content.replace(/^\n+/, "")
  const tags = [...new Set([...input.tags, ...toStringList(parsed.data.tags)])]
  const aliases = toStringList(parsed.data.aliases)
  const description = input.description ?? ""

  const lines = [
    "---",
    "publish: true",
    `title: ${titleFromPath(input.relativePath)}`,
    description === "" ? "description:" : `description: ${description}`,
    `date: ${formatDate(input.mtime)}`,
  ]
  if (tags.length > 0) lines.push("tags:", ...tags.map((tag) => `  - ${tag}`))
  if (aliases.length > 0) lines.push("aliases:", ...aliases.map((alias) => `  - ${alias}`))
  lines.push("---", "")

  return { text: lines.join("\n") + body + (body.endsWith("\n") ? "" : "\n"), description }
}

const listMarkdown = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((rel) => !rel.split(path.sep).some((segment) => segment.startsWith(".")))
    .sort((a, b) => a.localeCompare(b))
}

export async function planPromotion(options: PromoteOptions): Promise<PromotePlan> {
  const writes: PromotePlanItem[] = []
  const empty: string[] = []

  for (const relativePath of await listMarkdown(options.from)) {
    const absolute = path.join(options.from, relativePath)
    const raw = await fs.readFile(absolute, "utf8")
    if (raw.trim() === "") {
      empty.push(relativePath)
      continue
    }
    const stat = await fs.stat(absolute)
    const description = options.descriptions[relativePath.split(path.sep).join("/")]
    const { text } = buildEntry({
      relativePath,
      raw,
      mtime: stat.mtime,
      description,
      tags: options.tags,
    })
    writes.push({ relativePath, text, description: description ?? "" })
  }

  return { writes, empty }
}

const parseArgs = (argv: string[]): PromoteOptions | string => {
  const options: PromoteOptions = {
    from: "",
    to: "",
    tags: [],
    descriptions: {},
    force: false,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (!next) throw new Error(`${arg} 需要一个值`)
      return next
    }
    try {
      switch (arg) {
        case "--from":
          options.from = value()
          break
        case "--to":
          options.to = value()
          break
        case "--tag":
          options.tags.push(value())
          break
        case "--descriptions":
          options.descriptions = JSON.parse(readFileSync(value(), "utf8")) as Record<string, string>
          break
        case "--force":
          options.force = true
          break
        case "--dry-run":
          options.dryRun = true
          break
        case "--help":
        case "-h":
          return "help"
        default:
          return `未知参数 ${arg}`
      }
    } catch (error) {
      return (error as Error).message
    }
  }

  if (!options.from || !options.to) return "缺少 --from 或 --to"
  return options
}

export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv)
  if (parsed === "help") {
    process.stdout.write(
      "用法: tsx scripts/promote.ts --from <vault> --to <content/主题> [--tag 标签] [--descriptions map.json] [--force] [--dry-run]\n",
    )
    return 0
  }
  if (typeof parsed === "string") {
    process.stderr.write(parsed + "\n")
    return 2
  }

  try {
    await fs.access(parsed.from)
  } catch {
    process.stderr.write(`读不到 vault 目录：${parsed.from}\n`)
    return 2
  }

  const plan = await planPromotion(parsed)
  const conflicts: string[] = []
  const missing: string[] = []

  for (const item of plan.writes) {
    const target = path.join(parsed.to, item.relativePath)
    const exists = await fs
      .stat(target)
      .then(() => true)
      .catch(() => false)

    if (exists && !parsed.force) {
      conflicts.push(item.relativePath)
      process.stdout.write(`conflict ${item.relativePath} (已存在，加 --force 才覆盖)\n`)
      continue
    }

    if (item.description === "") missing.push(item.relativePath)
    if (!parsed.dryRun) {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, item.text)
    }
    process.stdout.write(`${parsed.dryRun ? "plan" : "wrote"} ${item.relativePath}\n`)
  }

  for (const rel of plan.empty) {
    process.stdout.write(`skip ${rel} (empty)\n`)
  }
  for (const rel of missing) {
    process.stdout.write(`TODO description: ${rel}\n`)
  }

  process.stdout.write(
    `\n写入 ${plan.writes.length - conflicts.length} 条；跳过空文件 ${plan.empty.length} 条；待补 description ${missing.length} 条\n`,
  )
  if (missing.length > 0) {
    process.stdout.write("补齐 description 后跑：npm run check:entries\n")
  }

  if (conflicts.length > 0) return 3
  if (missing.length > 0) return 1
  return 0
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  process.exit(await main(process.argv.slice(2)))
}
