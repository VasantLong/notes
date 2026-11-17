import { RelativeURL } from "./path"

/** A path segment boundary: everything from the first `?` or `#` is not a file name. */
const NOT_PATH = /[?#]/

/**
 * Encode one path (no query, no fragment) as a URI reference.
 *
 * Author-written links can arrive already escaped (`%20`, `%E4%B8%AD`), and `encodeURI` escapes the
 * `%` of an existing escape, so the path is decoded first and then encoded — that is what makes the
 * function idempotent. A malformed escape (`50%`) cannot be decoded at all, so it falls back to
 * encoding the raw text, where the stray `%` becomes a literal `%25`.
 */
const encodePath = (path: string): string => {
  try {
    return encodeURI(decodeURIComponent(path))
  } catch {
    return encodeURI(path)
  }
}

/**
 * Internal URLs in the emitted HTML are URI references, so they are percent-encoded (`中文 笔记` →
 * `%E4%B8%AD%E6%96%87-%E7%AC%94%E8%AE%B0`) while the artifact keeps its readable name.
 *
 * Only the path is encoded. A query string is a value of its own — decoding it would turn the
 * escaped `%26` of `?q=a%26b` into a real `&` separator — and a fragment names an element id, which
 * the outline emits verbatim (`#小节甲`), so both are passed through untouched.
 */
export const encodeInternalUrl = (url: string): RelativeURL => {
  const split = url.search(NOT_PATH)
  if (split < 0) return encodePath(url) as RelativeURL
  return `${encodePath(url.slice(0, split))}${url.slice(split)}` as RelativeURL
}

/** Characters that cannot appear raw in a URI reference: non-ASCII, whitespace and delimiters. */
const UNSAFE_HREF_CHARS = /[^\x00-\x7F]|[\s"<>\\^`{|}]/

/** A scheme (`https:`, `mailto:`, `javascript:`) — but not a relative path such as `../x:y`. */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

/** Every `href` attribute in a document. */
const HREF_ATTRIBUTE = /(\shref=")([^"]*)(")/g

/**
 * Percent-encode the internal `href` values a document still carries as raw UTF-8.
 *
 * Content links go through the Links transformer, which encodes them itself. Links built by
 * components — breadcrumbs, backlinks, folder and tag listings, the explorer's server-side
 * fallback — come straight from npm packages and reach the browser as raw UTF-8, which is not a
 * valid URI reference (`../../别处/`). Every page is written by one emitter, so the whole document
 * is normalized there: only values that contain a character needing escaping are touched, and
 * encoding is idempotent, so already-escaped content links and ASCII hrefs pass through unchanged.
 * In-page anchors (which name an element id) and external schemes (another origin) are left alone.
 */
export function encodeInternalHrefs(html: string): string {
  return html.replace(HREF_ATTRIBUTE, (match, before: string, href: string, after: string) => {
    if (href.startsWith("#") || HAS_SCHEME.test(href)) return match
    if (!UNSAFE_HREF_CHARS.test(href)) return match
    return `${before}${encodeInternalUrl(href)}${after}`
  })
}
