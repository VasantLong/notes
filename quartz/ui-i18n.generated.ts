// 由 scripts/gen-ui-dict.ts 从 quartz/i18n/locales 生成，勿手改。
// 手写补充走 quartz/ui-i18n/overlay.ts；重跑：npm run gen:ui-dict
import type { UiI18n } from "./ui-i18n/build-dict"

export const uiI18n: UiI18n = {
  strings: {
    亮色模式: "Light mode",
    关系图谱: "Graph View",
    反向链接: "Backlinks",
    指向原始笔记的链接: "Link to original",
    按标签筛选: "Filter by tag",
    探索: "Explorer",
    搜索: "Search",
    搜索些什么: "Search for something",
    "搜索内容...": "Search for something...",
    文件夹: "Folder",
    无描述: "No description provided",
    无法找到: "Not Found",
    无法找到反向链接: "No backlinks found",
    无题: "Untitled",
    暗色模式: "Dark mode",
    最近的笔记: "Recent Notes",
    标签: "Tag",
    标签索引: "Tag Index",
    没有匹配的标签: "No matching tags",
    "没有结果。": "No results.",
    目录: "Table of Contents",
    "私有笔记或笔记不存在。": "Either this page is private or doesn't exist.",
    花园: "Garden",
    "请尝试其他搜索词。": "Try another search term?",
    返回首页: "Return to Homepage",
    阅读模式: "Reader mode",
  },
  patterns: [
    {
      re: "^(\\d+)分钟阅读$",
      en: "$1 min read",
    },
    {
      re: "^包含(.+?)$",
      en: "Transclude of $1",
    },
    {
      re: "^查看更多(\\d+)篇笔记 →$",
      en: "See $1 more →",
    },
    {
      re: "^此标签下有(\\d+)条笔记。$",
      one: "$1 item with this tag.",
      other: "$1 items with this tag.",
    },
    {
      re: "^此文件夹下有(\\d+)条笔记。$",
      one: "$1 item under this folder.",
      other: "$1 items under this folder.",
    },
    {
      re: "^显示前(\\d+)个标签。$",
      en: "Showing first $1 tags.",
    },
    {
      re: "^总共有(\\d+)个标签。$",
      en: "Found $1 total tags.",
    },
    {
      re: "^最近的(\\d+)条笔记$",
      en: "Last $1 notes",
    },
  ],
}
