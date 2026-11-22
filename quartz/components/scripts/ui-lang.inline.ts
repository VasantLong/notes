/* 界面语言层：同一份 URL，只在浏览器里替换界面文案，不动笔记正文与标题。
   引导脚本（beforeDOMLoaded）已先写好 html[data-ui-lang]；这里负责 zh <-> en 互换。 */

type UiI18nPattern = { re: string; en?: string; one?: string; other?: string }
type UiI18n = { strings: Record<string, string>; patterns: UiI18nPattern[] }

const KEY = "uiLang"
// SAFETY: 字典由 UiLang 组件的 afterDOMLoaded 脚本在本文件之前写进 window；缺失时按空字典降级。
const STORE = window as unknown as { __UI_I18N__?: UiI18n }
const dict: UiI18n = STORE.__UI_I18N__ ?? { strings: {}, patterns: [] }
const root = document.documentElement

/* 正文、笔记标题与代码块永不替换；data-ui-skip 供切换器自己豁免 */
const SKIP =
  ".markdown-preview-view,.article-title,h1,pre,code,kbd,samp,textarea,script,style,[data-ui-skip]"
const ATTRS = ["title", "aria-label", "placeholder", "alt"] as const

const compiled = dict.patterns.map((pattern) => ({ pattern, re: new RegExp(pattern.re) }))
const textNodes: Text[] = []
const attrNodes: HTMLElement[] = []
let zhText = new WeakMap<Text, string>()
let zhAttrs = new WeakMap<HTMLElement, Record<string, string>>()

function fill(tpl: string, match: string[]): string {
  return tpl.replace(/\$(\d)/g, (_all, digit: string) => match[Number(digit)] ?? "")
}

function translate(text: string): string | null {
  const hit = dict.strings[text]
  if (typeof hit === "string") return hit
  for (const item of compiled) {
    const match = item.re.exec(text)
    if (match === null) continue
    const pattern = item.pattern
    if (pattern.one !== undefined || pattern.other !== undefined) {
      const count = Number.parseInt(match[1] ?? "", 10)
      const plural = count === 1 ? (pattern.one ?? pattern.other) : (pattern.other ?? pattern.one)
      return plural === undefined ? null : fill(plural, match)
    }
    if (pattern.en !== undefined) return fill(pattern.en, match)
  }
  return null
}

function skipped(node: Node): boolean {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement
  return element !== null && element.closest(SKIP) !== null
}

function applyText(node: Text): void {
  if (zhText.has(node)) return
  const raw = node.data
  const core = raw.trim()
  if (core === "") return
  const out = translate(core)
  if (out === null || out === core) return
  zhText.set(node, raw)
  textNodes.push(node)
  node.data = raw.replace(core, out)
}

function applyAttrs(element: HTMLElement): void {
  const store = zhAttrs.get(element) ?? {}
  let touched = false
  for (const attr of ATTRS) {
    if (store[attr] !== undefined) continue
    const raw = element.getAttribute(attr)
    if (raw === null) continue
    const core = raw.trim()
    if (core === "") continue
    const out = translate(core)
    if (out === null || out === core) continue
    store[attr] = raw
    element.setAttribute(attr, raw.replace(core, out))
    touched = true
  }
  if (!touched) return
  if (!zhAttrs.has(element)) {
    zhAttrs.set(element, store)
    attrNodes.push(element)
  }
}

/** SPA 换页后旧节点会被摘掉，先把追踪表里已离线的条目清掉，避免状态越滚越大。 */
function prune(): void {
  for (let index = textNodes.length - 1; index >= 0; index--) {
    if (!textNodes[index].isConnected) {
      zhText.delete(textNodes[index])
      textNodes.splice(index, 1)
    }
  }
  for (let index = attrNodes.length - 1; index >= 0; index--) {
    if (!attrNodes[index].isConnected) {
      zhAttrs.delete(attrNodes[index])
      attrNodes.splice(index, 1)
    }
  }
}

function translateAll(): void {
  prune()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const batch: Text[] = []
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    batch.push(node as Text)
  }
  for (const node of batch) {
    if (!skipped(node)) applyText(node)
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[title],[aria-label],[placeholder],[alt]",
  )) {
    if (!skipped(element)) applyAttrs(element)
  }
}

function restoreAll(): void {
  for (const node of textNodes) {
    const original = zhText.get(node)
    if (original !== undefined) node.data = original
  }
  for (const element of attrNodes) {
    const store = zhAttrs.get(element)
    if (store === undefined) continue
    for (const [attr, value] of Object.entries(store)) element.setAttribute(attr, value)
  }
  textNodes.length = 0
  attrNodes.length = 0
  zhText = new WeakMap<Text, string>()
  zhAttrs = new WeakMap<HTMLElement, Record<string, string>>()
}

function current(): string {
  return root.getAttribute("data-ui-lang") === "en" ? "en" : "zh"
}

function syncButtons(): void {
  for (const button of document.querySelectorAll("[data-ui-lang-btn]")) {
    const pressed = button.getAttribute("data-ui-lang-btn") === current()
    button.setAttribute("aria-pressed", pressed ? "true" : "false")
  }
}

function setLang(lang: string, persist: boolean): void {
  const next = lang === "en" ? "en" : "zh"
  if (persist) {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* 隐私模式或禁用 localStorage：降级为只在本页生效 */
    }
  }
  root.setAttribute("data-ui-lang", next)
  if (next === "en") translateAll()
  else restoreAll()
  syncButtons()
}

document.addEventListener("click", (event) => {
  const target = event.target as Element | null
  const button = target?.closest?.("[data-ui-lang-btn]") ?? null
  if (button === null) return
  event.preventDefault()
  setLang(button.getAttribute("data-ui-lang-btn") ?? "zh", true)
})

window.addEventListener("storage", (event) => {
  if (event.key === KEY) setLang(event.newValue ?? "zh", false)
})

/* SPA 换页：新 DOM 是服务端渲染的中文，固定顶栏按钮状态，必要时重新替换。 */
document.addEventListener("nav", () => {
  syncButtons()
  if (current() === "en") translateAll()
})

function boot(): void {
  if (current() === "en") translateAll()
  syncButtons()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot)
} else {
  boot()
}

/* 让 tsc 把本文件当成带默认导出的模块（UiLang.tsx 按字符串 import）。
   quartz/cli/handlers.js 的 inline-script-loader 编译前会把这一行剥掉，不会进产物。 */
export default ""
