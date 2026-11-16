import { StaticResources } from "./resources"

/**
 * Quartz 插件把第三方库地址硬编码在 `externalResources()` 里（latex 的 KaTeX、graph 运行时注入的
 * d3/pixi），站点配置改不掉它们。本站要求产物不请求任何第三方域名（规格故事 29），所以这些地址
 * 在收集阶段统一改写到自托管副本 `quartz/static/vendor/` 下。
 *
 * 副本由 `scripts/vendor-third-party.sh` 生成：改这里的键（URL 里的版本）时，同步改脚本里的版本。
 * 上游插件升级后 CDN 地址会变，映射表命中不到时产物测试（test/site-skeleton.test.ts）会立刻红。
 */
export const SELF_HOSTED_RESOURCES: Record<string, string> = {
  // @quartz-community/latex 硬编码 katex@0.16.11
  "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css":
    "/static/vendor/katex/katex.min.css",
  "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/copy-tex.min.js":
    "/static/vendor/katex/copy-tex.min.js",
  // @quartz-community/graph 在浏览器里动态注入 d3@7 / pixi.js@8
  "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js": "/static/vendor/d3.min.js",
  "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js": "/static/vendor/pixi.min.js",
}

/** 精确匹配的地址直接换掉；内联脚本/样式里嵌着的地址逐条替换。 */
export function localizeUrls(text: string): string {
  let out = text
  for (const [cdnUrl, localUrl] of Object.entries(SELF_HOSTED_RESOURCES)) {
    if (out.includes(cdnUrl)) out = out.split(cdnUrl).join(localUrl)
  }
  return out
}

/** 就地改写插件交上来的 CSS/JS 资源，让它们指向自托管副本。 */
export function localizeThirdPartyResources(resources: StaticResources): void {
  for (const css of resources.css) {
    css.content = localizeUrls(css.content)
  }
  for (const js of resources.js) {
    if (js.contentType === "external") {
      js.src = localizeUrls(js.src)
    } else {
      js.script = localizeUrls(js.script)
    }
  }
}
