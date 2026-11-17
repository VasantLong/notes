import { describe, test } from "node:test"
import assert from "node:assert/strict"

import { encodeInternalHrefs, encodeInternalUrl } from "./url-encoding"

describe("站内 URL：百分号编码为合法的 URI 引用", () => {
  test("中文与空格按字节编码，目录分隔符保留", () => {
    assert.equal(
      encodeInternalUrl("../../别处/更深"),
      "../../%E5%88%AB%E5%A4%84/%E6%9B%B4%E6%B7%B1",
    )
    assert.equal(encodeInternalUrl("带 空格"), "%E5%B8%A6%20%E7%A9%BA%E6%A0%BC")
  })

  test("纯 ASCII 的路径原样返回", () => {
    for (const path of ["../notes/page.html", "static/contentIndex.json", "./a-b_c~d"]) {
      assert.equal(encodeInternalUrl(path), path)
    }
  })

  test("已经转义过的路径只编码一次（幂等）", () => {
    const once = encodeInternalUrl("别处/中层")
    assert.equal(once, "%E5%88%AB%E5%A4%84/%E4%B8%AD%E5%B1%82")
    assert.equal(encodeInternalUrl(once), once)
    assert.equal(encodeInternalUrl("%E4%B8%AD"), "%E4%B8%AD")
  })

  test("残缺的转义无法解码，退回编码原文并把散落的 % 变成 %25", () => {
    assert.equal(encodeInternalUrl("50%/别处"), "50%25/%E5%88%AB%E5%A4%84")
  })

  test("查询串是它自己的值：不解码，%26 不会被还原成 & 分隔符", () => {
    assert.equal(encodeInternalUrl("页?q=a%26b"), "%E9%A1%B5?q=a%26b")
    assert.equal(encodeInternalUrl("页?q=中文"), "%E9%A1%B5?q=中文")
  })

  test("片段名是元素 id，原样保留（与目录的锚点写法一致）", () => {
    assert.equal(encodeInternalUrl("页#小节甲"), "%E9%A1%B5#小节甲")
  })
})

describe("站内 href：整篇文档里组件产出的裸 UTF-8 链接", () => {
  test("只改 href 里的站内路径，别的属性与文字不动", () => {
    const html = '<a href="别处/页" title="别处">别处</a>'
    assert.equal(
      encodeInternalHrefs(html),
      '<a href="%E5%88%AB%E5%A4%84/%E9%A1%B5" title="别处">别处</a>',
    )
  })

  test("页内锚点、外部协议、纯 ASCII 的 href 一律不碰", () => {
    const html = [
      '<a href="#小节甲">小节甲</a>',
      '<a href="https://example.com/中文">外链</a>',
      '<a href="../../index.html">首页</a>',
      '<meta property="og:url" content="別处">',
    ].join("")
    assert.equal(encodeInternalHrefs(html), html)
  })

  test("已编码的 href 再处理一次不变（幂等）", () => {
    const once = encodeInternalHrefs('<a href="别处/页">x</a>')
    assert.equal(encodeInternalHrefs(once), once)
  })
})
