/**
 * 组件内联脚本：esbuild 的 inline-script-loader 把 *.inline.ts 整个文件编译成一个字符串作为
 * 模块默认导出，源码自身没有 export。上游各处用 // @ts-ignore 绕过导入检查，这里给出正式声明，
 * 让 import uiLangScript from "./scripts/ui-lang.inline" 得到 string 类型。
 */
declare module "*.inline" {
  const source: string
  export default source
}

export declare global {
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void
  }
  /** A page fetched ahead by prefetch.inline.ts (`url` is where it came from, after redirects). */
  interface PrefetchedPage {
    url: string
    contentType: string
    /** The HTML; missing when the link turned out not to be a page. */
    text?: string
  }
  interface Window {
    spaNavigate(url: URL, isBack: boolean = false)
    addCleanup(fn: (...args: any[]) => void)
    /**
     * Set when prefetching is on: the page at `url` from the prefetch cache, or fetched now and
     * kept (undefined if it could not be fetched).
     */
    quartzPrefetch?: {
      load(url: URL): Promise<PrefetchedPage | undefined>
    }
    /** Absolute URL of the site's static/ folder (renderPage.tsx) */
    quartzStaticUrl?: string
    /** Prefetch settings, written by componentResources.ts ahead of prefetch.inline.ts */
    __quartzPrefetchMode?: "viewport" | "hover"
    __quartzSpa?: boolean
  }
}
