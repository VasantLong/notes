import { visit } from "unist-util-visit"
import { Element } from "hast"
import { ProcessedContent } from "../plugins/vfile"
import { filteredBy } from "./diagnostics"

/**
 * 指向"被过滤器移除的页面"（未发布、草稿）的站内链接，在 HTML 阶段之后补上 `broken` 标记。
 *
 * Why here: 过滤器在 HTML 阶段之后才跑（它看的是解析出来的前置字段），所以 links 内建插件
 * 无法预知目标会不会消失——`allSlugs` 里仍然列着未发布的笔记，链接看起来是活的却会 404。
 * 这一遍直接沿用过滤器自己的判决（`filteredBy`），而不是另写一套"什么算发布"的规则，
 * 保证站点上"未发布"只有一个定义。
 */
export function markUnpublishedLinks(content: ProcessedContent[]): void {
  for (const [tree] of content) {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return
      const slug = node.properties?.["data-slug"]
      if (typeof slug !== "string" || !filteredBy(slug)) return
      const classes = (node.properties?.className ?? []) as string[]
      if (classes.includes("broken")) return
      node.properties.className = [...classes, "broken"]
    })
  }
}
