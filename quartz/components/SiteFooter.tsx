import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { componentRegistry } from "./registry"
import { FullSlug, joinSegments, pathToRoot } from "../util/path"

/**
 * 标准站脚：第一行版权 + 站点链接，第二行许可声明（中英双语并置，由 data-ui-lang 切换）。
 *
 * 换掉 @quartz-community/footer 的原因：它的 “Created with Quartz vX © YYYY” 是硬编码，
 * message 选项只能追加一行，拼不出标准的两行站脚。
 */
const HOLDER = "Vasant Long"
const CONTENT_LICENSE = "https://creativecommons.org/licenses/by/4.0/"
const CODE_LICENSE = "https://github.com/VasantLong/notes/blob/main/LICENSE.txt"
const BLOG_URL = "https://vasantlong.de5.net"
const GITHUB_URL = "https://github.com/VasantLong"

const SiteFooter: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const year = new Date().getFullYear()
  const baseDir =
    fileData.slug === "404" ? ("/" as FullSlug) : pathToRoot(fileData.slug as FullSlug)
  const licensePath = joinSegments(baseDir, "license")

  return (
    <footer class="site-footer" data-site-footer>
      <div class="site-footer__row">
        <p class="site-footer__copyright">
          © {year} {HOLDER}
        </p>
        <ul class="site-footer__links">
          <li>
            <a href={GITHUB_URL}>GitHub</a>
          </li>
          <li>
            <a href={BLOG_URL}>
              <span data-ui-zh>博客</span>
              <span data-ui-en lang="en">
                Blog
              </span>
            </a>
          </li>
          <li>
            <a href={licensePath}>
              <span data-ui-zh>许可</span>
              <span data-ui-en lang="en">
                License
              </span>
            </a>
          </li>
        </ul>
      </div>
      <p class="site-footer__license">
        <span data-ui-zh>
          除特别注明外，笔记内容以{" "}
          <a href={CONTENT_LICENSE} rel="license">
            CC BY 4.0
          </a>{" "}
          发布，站点代码以 <a href={CODE_LICENSE}>MIT</a> 发布；由{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz</a> 构建。
        </span>
        <span data-ui-en lang="en">
          Unless otherwise noted, note content is licensed{" "}
          <a href={CONTENT_LICENSE} rel="license">
            CC BY 4.0
          </a>
          ; site code is <a href={CODE_LICENSE}>MIT</a>. Built with{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz</a>.
        </span>
      </p>
    </footer>
  )
}

SiteFooter.displayName = "SiteFooter"
SiteFooter.css = `
.site-footer {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 4rem 0 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--lightgray);
  font-size: 0.85rem;
  color: var(--darkgray);
}

.site-footer__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.site-footer__copyright,
.site-footer__license {
  margin: 0;
}

.site-footer__license {
  font-size: 0.8rem;
  opacity: 0.85;
}

.site-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.site-footer a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--lightgray);
}

.site-footer a:hover {
  color: var(--secondary);
}
`

/* 注册构造函数而不是组件本身：componentResources 会拿注册值当构造函数调用后读取
   css/beforeDOMLoaded/afterDOMLoaded，注册组件函数会得到一个 JSX 元素、脚本全丢。 */
componentRegistry.register("SiteFooter", () => SiteFooter, "quartz/components/SiteFooter.tsx")

export default (() => SiteFooter) satisfies QuartzComponentConstructor
