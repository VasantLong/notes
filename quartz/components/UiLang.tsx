import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { componentRegistry } from "./registry"
import uiLangScript from "./scripts/ui-lang.inline"
import { uiI18n } from "../ui-i18n.generated"

/**
 * 界面语言层（中/EN）。同一份 URL、同一套中文正文，只在浏览器里替换界面文案：
 * 顶栏放切换器，选中的语言记在 localStorage.uiLang，`<html data-ui-lang>` 由首帧引导
 * 脚本写好后，引擎（scripts/ui-lang.inline.ts）负责 zh <-> en 互换。
 *
 * 字典是 quartz/i18n/locales 的生成物（scripts/gen-ui-dict.ts），不要手写英文。
 */
const KEY = "uiLang"

const bootScript = `(function () {
  var lang = "zh"
  try {
    if (localStorage.getItem("${KEY}") === "en") lang = "en"
  } catch (error) {
    /* 隐私模式或禁用 localStorage：按中文渲染 */
  }
  document.documentElement.setAttribute("data-ui-lang", lang)
})()`

/* 结尾必须有分号：与 bootScript 拼在同一个同步脚本里，缺分号会被解析成 obj(function(){…})() */
const dictScript = `window.__UI_I18N__ = ${JSON.stringify(uiI18n).replace(/</g, "\\u003c")};`

const UiLang: QuartzComponent = (_props: QuartzComponentProps) => (
  <div class="ui-lang-switch" role="group" aria-label="界面语言 / Interface language" data-ui-skip>
    <button type="button" data-ui-lang-btn="zh" aria-pressed="true">
      中
    </button>
    <button type="button" data-ui-lang-btn="en" aria-pressed="false">
      EN
    </button>
  </div>
)

UiLang.displayName = "UiLang"
UiLang.css = `
.ui-lang-switch {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  margin-left: auto;
  overflow: hidden;
}

.ui-lang-switch button {
  background: transparent;
  border: 0;
  color: var(--darkgray);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  line-height: 1.4;
  padding: 0.05rem 0.45rem;
}

.ui-lang-switch button:hover {
  color: var(--secondary);
}

.ui-lang-switch button[aria-pressed="true"] {
  background: var(--lightgray);
  color: var(--dark);
}

/* 双语并置的文案（页脚许可声明等）：无 JS 时只显示中文，选中英文后只显示英文 */
html:not([data-ui-lang="en"]) [data-ui-en] {
  display: none;
}

html[data-ui-lang="en"] [data-ui-zh] {
  display: none;
}
`

/* 字典必须早于引擎：两者都放进 beforeDOMLoaded（<head> 同步脚本，按注册顺序拼接），
   引擎在 afterDOMLoaded 里单独成文件、页尾加载，一定后运行。 */
UiLang.beforeDOMLoaded = dictScript + "\n" + bootScript
UiLang.afterDOMLoaded = uiLangScript

/* 注册构造函数而不是组件本身：componentResources 会拿注册值当构造函数调用后读取
   css/beforeDOMLoaded/afterDOMLoaded，注册组件函数会得到一个 JSX 元素、脚本全丢。 */
componentRegistry.register("UiLang", () => UiLang, "quartz/components/UiLang.tsx")

export default (() => UiLang) satisfies QuartzComponentConstructor
