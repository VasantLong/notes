// 上游 explorer 的 `folderDefaultState` 只写进容器的 `data-collapsed` 属性，客户端脚本并不读它：
// 文件树在任何页面上都从「全部折叠」起步（例外是读者自己点开过、或当前条目就在那个目录里）。
// 结果就是新读者在首页只看到一个目录名（比如「党团」），以为里面的条目不存在。
// 这里补上默认展开：读者没有显式折叠过的目录一律展开；折叠状态仍由 explorer 自己记在
// localStorage 的 fileTree 里，读者点一下就收起，下次访问按他保存的状态来。

const SAVED_KEY = "fileTree"

const savedCollapseState = (): Map<string, boolean> => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")
    if (!Array.isArray(raw)) return new Map()
    return new Map(
      raw
        .filter((entry) => entry && typeof entry.path === "string")
        .map((entry) => [entry.path as string, Boolean(entry.collapsed)]),
    )
  } catch {
    return new Map()
  }
}

const expandUnknownFolders = () => {
  const saved = savedCollapseState()
  for (const container of document.querySelectorAll<HTMLElement>(".explorer .folder-container")) {
    if (container.dataset.explorerExpanded === "1") continue
    const outer = container.nextElementSibling
    if (!outer || !outer.classList.contains("folder-outer")) continue
    container.dataset.explorerExpanded = "1"
    // 读者收起过的目录保持收起，其余展开
    if (saved.get(container.dataset.folderpath ?? "") === true) continue
    outer.classList.add("open")
  }
}

let scheduled = false
const scheduleExpand = () => {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    expandUnknownFolders()
  })
}

// 文件树是异步按 contentIndex 渲染的，SPA 导航会把它整块换掉
new MutationObserver(scheduleExpand).observe(document.body, {
  childList: true,
  subtree: true,
})
document.addEventListener("nav", scheduleExpand)
scheduleExpand()
