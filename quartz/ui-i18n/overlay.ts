/**
 * 手写补充的界面文案：Quartz 插件自带的词表（不读 quartz/i18n/locales），以及本站专有名词。
 * 键是服务端渲染出来的中文原文，值是英文；同名键覆盖生成结果。
 */
export const overlayStrings: Record<string, string> = {
  // 站点标题（quartz.config.yaml 的 configuration.pageTitle）已经叫 notes，是英文，不需要译文
  // @quartz-community/search 自带词表，locales 表里没有这些串
  "搜索内容...": "Search for something...",
  "没有结果。": "No results.",
  "请尝试其他搜索词。": "Try another search term?",
  按标签筛选: "Filter by tag",
  没有匹配的标签: "No matching tags",
}
