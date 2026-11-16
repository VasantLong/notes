import path from "path"
import { warn } from "./diagnostics"

/**
 * 别名跳转的产物目录守卫。
 *
 * Why: 别名跳转页由 `@quartz-community/alias-redirects` 直接写到产物目录，它只防"和已渲染页面的 slug 撞名"，
 * 既不管站点自己产出的固定路径（`index.html`、`404.html`），也不检查写盘位置——于是 `aliases: [index]`
 * 会凭空造出一个会跳走的站点首页，根级条目的 `../x` 能把文件写到产物目录之外。两处口子都在跳转页
 * 渲染之前处理：本模块修剪 `file.data.aliases`（插件读的就是它）并写回，渲染仍然交给插件，不碰它的实现。
 * 覆盖不到的残留：同一插件的大小写重定向页（`enableCaseRedirects`）也在同一阶段写盘，与别名互撞时只有插件
 * 自己的 `console.warn` 兜底。
 */
export type DroppedAliasReason =
  "site-owned" | "collides-with-page" | "duplicate" | "escapes-output"

export interface DroppedAlias {
  /** 声明这个别名的条目 slug */
  page: string
  /** 被丢弃的别名（slug 形式，与插件读到的一致） */
  alias: string
  /** 这个别名本会写出的产物路径；越界的别名没有落点，故缺省 */
  output?: string
  reason: DroppedAliasReason
}

/**
 * 守卫只用 slug 与别名列表，参数放宽成结构类型：测试不必伪造整份 vfile。
 * 别名在这里始终是 slug 字符串（插件读到的就是 slug 形式），回写的也是同一形式。
 */
export interface AliasBearingFile {
  data: { slug?: string; aliases?: string[] }
}

/**
 * 站点自己在产物根上固定产出的路径（用下面的比较键表示）。空串就是站点首页——插件的比较键
 * 把 `index` 与空 slug 当同一页，守卫跟它同口径。
 */
const SITE_OWNED_KEYS = new Set(["", "404"])

/**
 * 插件 `isRelativeURL` 的原样口径：以 `.`/`..` 开头，且**不以 `index` 结尾**、扩展名不是 `.md`/`.html`。
 * 漏掉后两条判据就会算错落点：插件把 `./index` 当成根级别名，直接写到产物根上。
 */
function isRelativeAlias(alias: string): boolean {
  if (!/^\.{1,2}/.test(alias)) return false
  if (alias === "index" || alias.endsWith("/index")) return false
  const extension = /\.[A-Za-z0-9]+$/.exec(alias)?.[0] ?? ""
  return extension !== ".md" && extension !== ".html"
}

/**
 * 条目的页面 slug（与插件 `simplifySlug` 同口径：去掉尾部 `index` 与首尾斜杠，根页记作 `/`）。
 * 根页保留 `/` 而不是空串：插件的相对别名用它做 `join` 基准，换成空串会把 `./x` 算成 `../x`。
 */
function pageSlugOf(slug: string): string {
  const trimmed =
    slug === "index" || slug.endsWith("/index") ? slug.slice(0, -"index".length) : slug
  const stripped = trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
  return stripped === "" ? "/" : stripped
}

/**
 * 与插件 `normalizeForComparison` 一致的比较键：`index`、空 slug、`x/index` 与 `x` 都视为同一页。
 * 守卫判撞名必须与插件同一口径，否则会出现"守卫放行、插件丢弃"两套规则。
 */
export function comparisonKey(slug: string): string {
  const normalized = path.posix.normalize(slug.replace(/\\/g, "/")).replace(/^\/+|\/+$/g, "")
  if (normalized === "." || normalized === "index") return ""
  return normalized.replace(/\/index$/, "")
}

/** 用哨兵根复算插件写盘位置：路径先拼成绝对路径再归一化，越界与否一眼可见。 */
const OUTPUT_ROOT = "/__out__"

/**
 * 别名会落到产物目录里的哪个文件，解析方式照抄插件：以 `.` 开头的别名相对条目所在目录解析
 * （`别处/笔记` 声明 `../旧名`，落点是根上的 `旧名`），其余别名就是根相对的 slug；
 * 插件写盘是 `joinSegments(output, slug + ".html")` 后直接 `writeFile`，所以是否越界只能靠归一化后的
 * 绝对路径判断。返回 `undefined` 表示落点跑出了产物目录。
 */
export function aliasOutputPath(alias: string, pageSlug: string): string | undefined {
  const target = isRelativeAlias(alias)
    ? path.posix.normalize(path.posix.join(pageSlugOf(pageSlug), "..", alias))
    : alias.replace(/\\/g, "/")
  const absolute = path.posix.normalize(path.posix.join(OUTPUT_ROOT, `${target}.html`))
  const prefix = `${OUTPUT_ROOT}/`
  if (!absolute.startsWith(prefix)) return undefined
  const relative = absolute.slice(prefix.length)
  return relative === "" ? undefined : relative
}

/**
 * 原始别名。修剪是就地写回 `file.data.aliases` 的，而 watch 模式只重新解析改动过的文件、其余 vfile
 * 对象被下一次构建原样复用——不记住原始值的话，被丢弃的别名就再也回不来（退化成"第一次构建说了算"）。
 */
const pristineAliases = new WeakMap<AliasBearingFile, string[]>()

function originalAliases(file: AliasBearingFile): string[] {
  const cached = pristineAliases.get(file)
  if (cached !== undefined) return cached
  const current = Array.isArray(file.data.aliases) ? [...file.data.aliases] : []
  pristineAliases.set(file, current)
  return current
}

/**
 * 清掉会顶掉站点页面、会和已有页面撞名、会越界、以及已被更早条目占用的别名，返回每一条的丢弃明细
 * （丢掉一律记进构建诊断，不静默吞掉）。
 *
 * 撞名归属用固定规则：按传入的内容顺序先声明者得——同一别名被两条笔记申报时必须有一个确定答案。
 * 该顺序在全量构建里是路径排序、在 `--serve` 增量里是插入顺序，所以同一批内容内结论确定，两种执行模式
 * 之间可能给出不同归属（各自都只产出一条跳转页）。
 */
export function sanitizeAliases(
  content: readonly (readonly [unknown, AliasBearingFile])[],
): DroppedAlias[] {
  const dropped: DroppedAlias[] = []
  const pageKeys = new Set<string>()
  for (const [, file] of content) {
    const slug = file.data.slug
    if (typeof slug === "string" && slug !== "") pageKeys.add(comparisonKey(slug))
  }

  const claimed = new Set<string>(SITE_OWNED_KEYS)
  for (const [, file] of content) {
    const slug = file.data.slug ?? ""
    const kept: string[] = []
    for (const alias of originalAliases(file)) {
      const output = aliasOutputPath(alias, slug)
      if (output === undefined) {
        dropped.push({ page: slug, alias, reason: "escapes-output" })
        continue
      }
      const key = comparisonKey(output.replace(/\.html$/, ""))
      if (pageKeys.has(key)) {
        dropped.push({ page: slug, alias, output, reason: "collides-with-page" })
        continue
      }
      if (SITE_OWNED_KEYS.has(key)) {
        dropped.push({ page: slug, alias, output, reason: "site-owned" })
        continue
      }
      if (claimed.has(key)) {
        dropped.push({ page: slug, alias, output, reason: "duplicate" })
        continue
      }
      claimed.add(key)
      kept.push(alias)
    }
    file.data.aliases = kept
  }
  return dropped
}

const REASON_TEXT: Record<DroppedAliasReason, (dropped: DroppedAlias) => string> = {
  "site-owned": (d) => `别名 "${d.alias}"（${d.page}）会顶掉站点自己的页面 ${d.output}，已忽略`,
  "collides-with-page": (d) =>
    `别名 "${d.alias}"（${d.page}）与已有条目页面 ${d.output} 撞名，已忽略`,
  duplicate: (d) => `别名 "${d.alias}"（${d.page}）已被更早的声明占用 ${d.output}，已忽略`,
  "escapes-output": (d) => `别名 "${d.alias}"（${d.page}）会写到产物目录之外，已忽略`,
}

/** 守卫 + 把每一条丢弃都记进构建诊断（去重，构建结束时汇总）。 */
export function guardAliases(content: readonly (readonly [unknown, AliasBearingFile])[]): void {
  for (const dropped of sanitizeAliases(content)) {
    warn({ area: "aliases", message: REASON_TEXT[dropped.reason](dropped) })
  }
}
