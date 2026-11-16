import path from "path"

/**
 * 产物 HTML 的可观察面：只读文本，不碰插件内部。
 *
 * 这些函数供多个测试文件共享（链接解析、附件引用、编码断言的口径必须一致），
 * 判定一律"从产物页出发能否命中真实产物文件"，不断言 HTML 结构的字面形状。
 */

/** 产物里一个 <a> 的可观察属性：显示文本、href、class 列表。 */
export interface Anchor {
  text: string
  href: string
  classes: string[]
}

export function anchors(html: string): Anchor[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => {
    const attrs = m[1]
    return {
      href: /\bhref="([^"]*)"/.exec(attrs)?.[1] ?? "",
      classes: (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/).filter(Boolean),
      text: m[2]
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    }
  })
}

/** 去掉锚点并解码：产物里的内部 URL 是百分号编码的，产物文件名不是。 */
export const withoutAnchor = (href: string) => decodeURI(href.split("#")[0])

/** href 从产物页面出发解析到实际文件；prettyLinks 去掉 .html，两种形态都算命中。 */
export function resolveHref(files: string[], fromPage: string, href: string): string | undefined {
  const clean = withoutAnchor(href)
  if (!clean || clean.startsWith("#")) return undefined
  const target = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromPage), decodeURI(clean)),
  )
  const candidates = [target, `${target}.html`, path.posix.join(target, "index.html")]
  return candidates.find((candidate) => files.includes(candidate))
}

export const anchorFor = (list: Anchor[], text: string) => list.find((a) => a.text === text)

export const imageSources = (html: string) =>
  [...html.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi)].map((m) => m[1])

export const isEncoded = (url: string) => /%[0-9A-F]{2}/i.test(url)
