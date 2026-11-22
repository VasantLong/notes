/**
 * 界面双语字典的生成逻辑：把 Quartz 自带的中英文表拍平成「中文原文 → 英文」映射。
 *
 * 函数型翻译（`({ minutes }) => `${minutes}分钟阅读``）没法当字符串查表，这里用哨兵参数
 * 调一次拿到模板，转成客户端可用的正则 + 替换模板。CLI 见 scripts/gen-ui-dict.ts，
 * 产物是 quartz/ui-i18n.generated.ts。
 */
import zhCN from "../i18n/locales/zh-CN"
import enUS from "../i18n/locales/en-US"
import { overlayStrings } from "./overlay"

export type UiI18nPattern = { re: string; en?: string; one?: string; other?: string }
export type UiI18n = { strings: Record<string, string>; patterns: UiI18nPattern[] }

/** 这些参数对应的位置按数字捕获（`(\\d+)`），其余按非贪婪通配（`(.+?)`）。 */
const NUMERIC_PARAMS = new Set(["minutes", "count", "remaining", "items", "words", "pages"])

/** 界面文案里不会出现的字符，用来标记插值位置。 */
const SLOT = "\u0000"

/** callout.* 是正文里的块标题（笔记/提示/警告），属内容语气，不进界面字典。 */
const EXCLUDE_PREFIXES = ["components.callout."]

type TranslateFn = (args: Record<string, unknown>) => string
type Table = Record<string, unknown>

function isTranslateFn(value: unknown): value is TranslateFn {
  return typeof value === "function"
}

function flatten(
  table: Table,
  prefix = "",
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  for (const [key, value] of Object.entries(table)) {
    const path = prefix === "" ? key : `${prefix}.${key}`
    if (value !== null && typeof value === "object") {
      flatten(value as Table, path, out)
    } else {
      out.set(path, value)
    }
  }
  return out
}

/** 用一个「回显给定值」的参数对象调用翻译函数，顺带记录它读了哪些参数名。 */
function invoke(fn: TranslateFn, value: string | number, params: string[]): string {
  const args = new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined
      params.push(prop)
      return value
    },
  })
  return fn(args)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 把「按槽位切开的分段」拼成 `$1` 风格的替换模板。 */
function template(parts: string[]): string {
  return parts
    .map((part, index) => (index === parts.length - 1 ? part : `${part}$${index + 1}`))
    .join("")
}

/**
 * 单复数分支：英文表里 `count === 1 ? "1 item" : `${count} items`` 这类写法，用 1 和 2
 * 各调一次，再把传进去的数值换回槽位，就得到两个变体的模板。
 */
function variantTemplate(fn: TranslateFn, value: number): string {
  const raw = invoke(fn, value, [])
  return template(raw.split(String(value)))
}

function buildPattern(zhFn: TranslateFn, enFn: TranslateFn): UiI18nPattern | null {
  const zhParams: string[] = []
  const zhParts = invoke(zhFn, SLOT, zhParams).split(SLOT)
  const enParams: string[] = []
  const enParts = invoke(enFn, SLOT, enParams).split(SLOT)

  if (zhParts.length < 2) return null
  if (zhParts.length !== enParts.length) return null
  if (zhParams.join("\u0001") !== enParams.join("\u0001")) return null

  let re = "^"
  for (const [index, part] of zhParts.entries()) {
    re += escapeRegExp(part)
    const param = zhParams[index]
    if (param !== undefined) re += NUMERIC_PARAMS.has(param) ? "(\\d+)" : "(.+?)"
  }
  re += "$"

  const en = template(enParts)
  const one = variantTemplate(enFn, 1)
  const other = variantTemplate(enFn, 2)
  return one === other ? { re, en } : { re, one, other }
}

export function buildUiI18n(): { dict: UiI18n; conflicts: string[] } {
  const zh = flatten(zhCN as unknown as Table)
  const en = flatten(enUS as unknown as Table)
  const strings: Record<string, string> = {}
  const patterns = new Map<string, UiI18nPattern>()
  const conflicts: string[] = []

  for (const [path, zhValue] of zh) {
    if (EXCLUDE_PREFIXES.some((prefix) => path.startsWith(prefix))) continue
    const enValue = en.get(path)
    if (enValue === undefined) continue

    if (typeof zhValue === "string") {
      if (typeof enValue !== "string" || enValue === zhValue) continue
      const existing = strings[zhValue]
      if (existing !== undefined && existing !== enValue) {
        conflicts.push(`${path}:「${zhValue}」已有译文「${existing}」，表里又给了「${enValue}」`)
        continue
      }
      strings[zhValue] = enValue
      continue
    }

    if (!isTranslateFn(zhValue) || !isTranslateFn(enValue)) continue
    const built = buildPattern(zhValue, enValue)
    if (built === null) {
      conflicts.push(`${path}: 中英插值位置对不上，未生成模式`)
      continue
    }
    patterns.set(built.re, built)
  }

  Object.assign(strings, overlayStrings)

  const sortedStrings: Record<string, string> = {}
  for (const key of Object.keys(strings).sort()) sortedStrings[key] = strings[key]

  return {
    dict: {
      strings: sortedStrings,
      // 不要用 localeCompare：ICU 排序规则随 Node/locale 变化，CI（Linux + 不同 ICU）会排出
      // 与本地不同的顺序，deepStrictEqual 断言随之失败。按码位比较才是跨机稳定的。
      patterns: [...patterns.values()].sort((a, b) => (a.re < b.re ? -1 : a.re > b.re ? 1 : 0)),
    },
    conflicts,
  }
}

export function renderDictModule(dict: UiI18n): string {
  return [
    "// 由 scripts/gen-ui-dict.ts 从 quartz/i18n/locales 生成，勿手改。",
    "// 手写补充走 quartz/ui-i18n/overlay.ts；重跑：npm run gen:ui-dict",
    'import type { UiI18n } from "./ui-i18n/build-dict"',
    "",
    `export const uiI18n: UiI18n = ${JSON.stringify(dict, null, 2)}`,
    "",
  ].join("\n")
}
