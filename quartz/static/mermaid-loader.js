/**
 * Mermaid 载入器：让前端插件拿到自托管的 mermaid 而不去请求第三方 CDN（规格故事 29）。
 *
 * @quartz-community/obsidian-flavored-markdown 的图渲染脚本会 `import("<mermaid 地址>")`，
 * 再把默认导出当成 mermaid 对象用（initialize/run）。上游写死的是 cdnjs 上的 ESM 版本，
 * 由 quartz/util/self-host.ts 把那个地址改写到这里。
 *
 * 为什么不用上游的 ESM 包：它的 .mjs 入口只是薄壳，真正代码在 chunks/*.mjs（2.6MB 几十个文件），
 * 且 .mjs 在 GitHub Pages 上 MIME 不可控。改用官方 UMD 单文件 + 这层薄壳：脚本标签加载完
 * 运行时就挂在 globalThis.mermaid 上，这里把它转成模块默认导出。
 */
const RUNTIME_URL = new URL("./vendor/mermaid/mermaid.min.js", import.meta.url)

function loadRuntime() {
  if (globalThis.mermaid) return Promise.resolve(globalThis.mermaid)
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = RUNTIME_URL.href
    script.onload = () => {
      if (globalThis.mermaid) resolve(globalThis.mermaid)
      else reject(new Error("mermaid 运行时加载后没有挂到 globalThis：" + RUNTIME_URL.href))
    }
    script.onerror = () => reject(new Error("mermaid 运行时加载失败：" + RUNTIME_URL.href))
    document.head.append(script)
  })
}

export default await loadRuntime()
