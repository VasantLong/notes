# 写作与晋升

> 面向作者：一条笔记从 Obsidian 到线上的全过程。仓库侧的命令与部署见 [deploy.md](deploy.md)。

## 阶段速查

| #   | 阶段 | 动作                                                                          | 判据                        |
| --- | ---- | ----------------------------------------------------------------------------- | --------------------------- |
| 1   | 写作 | 在私人 vault（本机为 `~/文档/demo/`）里用 Obsidian 写                         | 无                          |
| 2   | 定稿 | 只挑讲完了一条概念的笔记；没写完的留在 vault                                  | 一条 = 一个可独立提问的概念 |
| 3   | 晋升 | 复制进 `content/`，保持目录结构，补齐四字段                                   | 四字段齐全                  |
| 4   | 校验 | `npx prettier --write content` → `npm run check:entries` → `npx quartz build` | 闸门 0 退出；产物抽查通过   |
| 5   | 发布 | 提交、push `main`                                                             | CI 绿 + 线上 URL 200        |

## 条目契约（四字段）

| 字段          | 要求                            | 说明                                                                |
| ------------- | ------------------------------- | ------------------------------------------------------------------- |
| `publish`     | 必须是布尔真 `true`             | 字符串 `"true"` 不算；**漏写 = 这条笔记对站点不存在**，闸门不会报错 |
| `title`       | 非空                            | 一般取文件名；章节文件的序号前缀可以去掉                            |
| `description` | 非空，≤80 字（按 Unicode 码点） | 写"这条能回答什么问题"，不写"本文介绍……"                            |
| `date`        | 可解析日期                      | 取源文件 mtime，不要统一填当天                                      |

`tags` 可选；保留原文里的标签，再加一个主题标签便于汇总。`aliases` 会生成跳转页（旧 URL → 新条目），空 `aliases:`（YAML null）要删掉。

## 晋升步骤

> 批量晋升用脚本，不要手抄 frontmatter：
>
> ```bash
> npx tsx scripts/promote.ts --from ~/文档/demo/党团 --to content/党团 \
>   --tag 党团 --descriptions /tmp/descriptions.json
> ```
>
> 它复制目录结构、按源文件 mtime 填 `date`、生成 `publish: true`/标题、跳过 0 字节文件、保留原 `tags`/`aliases`。`description` 需要人写：没给映射表（`{"相对路径": "描述"}`）就留空并以 1 退出，补齐后再跑闸门；目标已存在时默认不覆盖（`--force` 才改写，否则以 3 退出）。`--dry-run` 只打印计划。

1. **复制，不改写**：目录、文件名原样搬进 `content/`。中文不转写、空格转 `-`，URL 跟随路径。
2. **补前置字段**：用上面的四字段表格逐条填；正文一个字都别动。
3. **空文件不晋升**：0 字节笔记没有内容可写 `description`，进了 `content/` 只会留一条断链。要么补写，要么留在 vault。
4. **断链要显式**：构建诊断会打印 `N links … not on the site`（指向未发布/不存在的笔记），产物里这些链接带 `broken` 标记但**不会让构建失败**。晋升后要么把目标补齐，要么在提交说明里写明"已知 N 条断链"。
5. **验证正文零改动**：去掉 frontmatter、去掉所有空白字符后比对源文件与落库文件；prettier 只该动空白与列表符号。
6. **产物抽查**（比看日志可靠）：
   - 块引用：`[[笔记#^abc123]]` 在产物里应有 `id="abc123"`，链接 `…html#abc123` 能跳；
   - 嵌入：`![[另一条]]`、`![[另一条#^id|别名]]` 的内容真的出现在 HTML 里；
   - 标签：`/tags/<标签>` 页写"此标签下有 N 条笔记"，N 对得上；
   - 别名：`aliases` 里每个名字都应有一个跳转页。

## 命令清单

```bash
npx prettier --write content          # 先收敛格式
npm run check:entries                 # 四字段闸门
npx quartz build -d content -o tmp/verify-out   # 真构建，产物在 tmp/（tmp/ 已 gitignore）
```

## 常见坑

| 现象                                                   | 原因                                                         | 处理                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 编辑器报 `link to non-existent heading`                | 编辑器把 `#^块id` 当标题                                     | 假阳性，以构建产物为准                                         |
| `npx quartz build -d tmp/xxx` 报 `Found 0 input files` | `tmp/` 在 `.gitignore` 里，Quartz 的输入 glob 遵守 gitignore | 临时 fixture 放 `.scratch/`                                    |
| 刚部署后左侧树/图谱/搜索缺内容                         | `static/contentIndex.json` 有 10 分钟缓存                    | 硬刷新，或等 10 分钟；见 [DEGRADATIONS.md](../DEGRADATIONS.md) |
| 条目能直链打开，但列表里没有                           | 同上（导航读的是索引）                                       | 同上                                                           |
| 构建绿但线上没变                                       | 部署 job 只认 push 到 main                                   | 看 Actions 里 deploy job 是否跑了                              |
