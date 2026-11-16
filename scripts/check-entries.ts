#!/usr/bin/env tsx
/**
 * 条目契约校验的 CLI 外壳：遍历花园库、逐条打印违规、有违规就非 0 退出。
 *
 * 用法：
 *   npx tsx scripts/check-entries.ts                # 校验 content/
 *   npx tsx scripts/check-entries.ts --dir content
 *
 * 退出码：0 = 全部通过，1 = 有违规，2 = 用法错误。
 */
import fs from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"

import {
  isInNeverPublishedDirectory,
  validateEntry,
  type EntryViolation,
} from "../quartz/util/entry-contract"

const DEFAULT_DIR = "content"

const usage = () => `用法: tsx scripts/check-entries.ts [--dir <花园库目录>]`

const parseArgs = (argv: string[]): { dir: string } | null => {
  let dir = DEFAULT_DIR
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--dir") {
      const value = argv[i + 1]
      if (!value) return null
      dir = value
      i++
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length)
    } else if (arg === "--help" || arg === "-h") {
      return null
    } else {
      return null
    }
  }
  return { dir }
}

const toPosix = (p: string) => p.split(path.sep).join("/")

const listMarkdown = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => toPosix(path.relative(root, path.join(entry.parentPath, entry.name))))
    .filter((rel) => !rel.split("/").some((segment) => segment.startsWith(".")))
    .filter((rel) => !isInNeverPublishedDirectory(rel))
    .sort()
}

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed) {
    process.stderr.write(usage() + "\n")
    process.exit(2)
  }
  const dir = path.resolve(parsed.dir)

  let files: string[]
  try {
    files = await listMarkdown(dir)
  } catch (error) {
    process.stderr.write(`读不到花园库 ${dir}: ${(error as Error).message}\n`)
    process.exit(2)
  }

  const violations: EntryViolation[] = []
  for (const rel of files) {
    const raw = await fs.readFile(path.join(dir, rel), "utf8")
    const { data } = matter(raw)
    violations.push(...validateEntry(data, rel.replace(/\.md$/i, "")))
  }

  if (violations.length === 0) {
    process.stdout.write(`✓ ${files.length} 条条目满足契约\n`)
    process.exit(0)
  }

  for (const violation of violations) {
    process.stdout.write(`${violation.slug}.md — ${violation.field}: ${violation.message}\n`)
  }
  process.stderr.write(`✗ ${violations.length} 处违规，${files.length} 条条目被检查\n`)
  process.exit(1)
}

await main()
