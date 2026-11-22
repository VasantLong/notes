#!/usr/bin/env node
/**
 * 生成 / 校验界面双语字典 quartz/ui-i18n.generated.ts。
 *
 * 为什么不能手写：Quartz 的 i18n 表有四十多个叶子键、含函数型插值与单复数，手写必漏；
 * 插件升级后键会漂移，所以带 --check 模式给 npm run check 用。
 *
 * 用法：
 *   npm run gen:ui-dict            # 重新生成
 *   npx tsx scripts/gen-ui-dict.ts --check   # 只校验是否漂移
 */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { format, resolveConfig } from "prettier"
import { buildUiI18n, renderDictModule } from "../quartz/ui-i18n/build-dict"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outPath = path.join(repoRoot, "quartz", "ui-i18n.generated.ts")

async function render(): Promise<{
  text: string
  conflicts: string[]
  strings: number
  patterns: number
}> {
  const { dict, conflicts } = buildUiI18n()
  const options = (await resolveConfig(outPath)) ?? {}
  const text = await format(renderDictModule(dict), { ...options, parser: "typescript" })
  return {
    text,
    conflicts,
    strings: Object.keys(dict.strings).length,
    patterns: dict.patterns.length,
  }
}

const check = process.argv.slice(2).includes("--check")
const { text, conflicts, strings, patterns } = await render()

for (const conflict of conflicts) console.warn(`冲突：${conflict}`)

if (check) {
  const current = await readFile(outPath, "utf8").catch(() => "")
  if (current !== text) {
    console.error("FAIL 界面字典漂移：请跑 npm run gen:ui-dict 后提交 quartz/ui-i18n.generated.ts")
    process.exit(1)
  }
  console.log(`OK 界面字典与 Quartz i18n 表一致（${strings} 串 + ${patterns} 模式）`)
} else {
  await writeFile(outPath, text, "utf8")
  console.log(`写出 quartz/ui-i18n.generated.ts（${strings} 串 + ${patterns} 模式）`)
}
