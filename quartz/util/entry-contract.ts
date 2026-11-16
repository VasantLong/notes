/**
 * 条目契约校验器。
 *
 * 纯函数：不碰磁盘、不依赖插件、不读配置，同一输入永远得到同一顺序的输出。
 * 它只回答“这条笔记的前置字段合不合契约”，发布态（draft / unlisted / 被忽略的
 * 目录）由构建闸门判定，这里不看 draft 字段，避免两处真相源。
 */

/** description 的上限，按字（Unicode 码点）计。 */
export const DESCRIPTION_MAX_LENGTH = 80

/** 这三类目录即使有笔记也不该满足「要发布」的契约，校验与构建都跳过它们。 */
export const NEVER_PUBLISHED_DIRECTORIES = ["private", "templates", "inbox"] as const

export type EntryViolationField = "publish" | "title" | "description" | "date"

export interface EntryViolation {
  /** 条目标识，通常是不带 .md 的相对路径；仅用于定位，不参与判定。 */
  slug: string
  field: EntryViolationField
  message: string
}

export type EntryFrontmatter = Record<string, unknown>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

/** 可解析 = 能落到一个真实的时刻；YAML 解出的 Date 对象也算。 */
const toTimestamp = (value: unknown): number => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return new Date(value).getTime()
  if (typeof value === "string") return Date.parse(value.trim())
  return Number.NaN
}

const countChars = (text: string): number => [...text.trim()].length

/**
 * 校验一条笔记的前置字段，返回违规列表；空列表即通过。
 * 输出顺序固定为 publish → title → description → date。
 */
export function validateEntry(frontmatter: EntryFrontmatter, slug: string): EntryViolation[] {
  const violations: EntryViolation[] = []
  const push = (field: EntryViolationField, message: string) =>
    violations.push({ slug, field, message })

  // 没有 publish 字段 = 这条笔记不是条目：构建期 explicit-publish 会让它「不存在」，
  // 校验器不再补一刀（花园库里写半截的段落不该拦住 push）。这是两处闸门的分工。
  if (frontmatter.publish === undefined) return violations

  const publish = frontmatter.publish
  if (publish !== true) {
    push("publish", `publish 必须是布尔真，当前是 ${JSON.stringify(publish)}（字符串 "true" 不算）`)
  }

  if (!isNonEmptyString(frontmatter.title)) {
    push("title", "title 缺失或为空")
  }

  if (!isNonEmptyString(frontmatter.description)) {
    push("description", "description 缺失或为空")
  } else {
    const length = countChars(frontmatter.description)
    if (length > DESCRIPTION_MAX_LENGTH) {
      push("description", `description 有 ${length} 字，超过 ${DESCRIPTION_MAX_LENGTH} 字上限`)
    }
  }

  const date = frontmatter.date
  if (date === undefined || date === null || date === "") {
    push("date", "date 缺失（需要可解析的日期，如 2026-11-16）")
  } else if (Number.isNaN(toTimestamp(date))) {
    push("date", `date 不可解析：${JSON.stringify(date)}`)
  }

  return violations
}

/** 判断一个相对路径是否落在永不发布的目录里（任意深度）。 */
export function isInNeverPublishedDirectory(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]/)
    .some((segment) => (NEVER_PUBLISHED_DIRECTORIES as readonly string[]).includes(segment))
}
