import { describe, test } from "node:test"
import assert from "node:assert/strict"

import { aliasOutputPath, comparisonKey, sanitizeAliases } from "../quartz/util/alias-redirects"

const file = (slug: string, aliases: string[]) => ({ data: { slug, aliases } })
const content = (...files: ReturnType<typeof file>[]) => files.map((f) => [null, f] as const)

describe("别名守卫：掉哪些别名", () => {
  test("站点自己的页面（首页 index、404）不许被别名占用", () => {
    const page = file("笔记", ["index", "404", "正常旧名"])
    const dropped = sanitizeAliases(content(page))

    assert.deepEqual(page.data.aliases, ["正常旧名"])
    assert.deepEqual(
      dropped.map((d) => [d.alias, d.reason]),
      [
        ["index", "site-owned"],
        ["404", "site-owned"],
      ],
    )
  })

  test("与已有条目页面撞名时丢弃，原条目页面不受影响", () => {
    const occupied = file("占位页", [])
    const thief = file("抢别名页", ["占位页"])
    const dropped = sanitizeAliases(content(occupied, thief))

    assert.deepEqual(thief.data.aliases, [])
    assert.deepEqual(
      dropped.map((d) => [d.alias, d.output, d.reason]),
      [["占位页", "占位页.html", "collides-with-page"]],
    )
  })

  test("同一别名被两页申报：先声明者得，且后来者不会永久失去它", () => {
    const first = file("甲", ["共同旧名"])
    const second = file("乙", ["共同旧名"])
    sanitizeAliases(content(first, second))

    assert.deepEqual(first.data.aliases, ["共同旧名"])
    assert.deepEqual(second.data.aliases, [])

    // watch 模式会原样复用未改动的 vfile：对手让出别名后，被丢弃的别名必须能回来
    sanitizeAliases(content(second))
    assert.deepEqual(second.data.aliases, ["共同旧名"])
  })

  test("越界的别名被丢弃：根级条目的 ../ 会写到产物目录之外", () => {
    const page = file("抢别名页", ["../逃逸出界"])
    const dropped = sanitizeAliases(content(page))

    assert.deepEqual(page.data.aliases, [])
    assert.deepEqual(
      dropped.map((d) => [d.alias, d.reason]),
      [["../逃逸出界", "escapes-output"]],
    )
    assert.equal(dropped[0].output, undefined, "越界别名没有产物落点")
  })

  test("子目录条目的 ../ 别名相对条目所在目录解析，仍在产物目录内", () => {
    assert.equal(aliasOutputPath("../旧名", "别处/笔记"), "旧名.html")
    assert.equal(aliasOutputPath("../../逃逸", "别处/笔记"), undefined)

    const page = file("别处/笔记", ["../旧名"])
    assert.deepEqual(sanitizeAliases(content(page)), [])
    assert.deepEqual(page.data.aliases, ["../旧名"])
  })

  test("以 index 结尾的别名不算相对别名：./index 落到产物根，深层 ../index 直接越界", () => {
    // 插件 isRelativeURL 会把 index 结尾的排除掉，于是 ./index 变成根级别名、../index 变成根相对路径
    assert.equal(aliasOutputPath("./index", "别处/笔记"), "index.html")
    assert.equal(aliasOutputPath("../index", "a/b/笔记"), undefined)

    const home = file("别处/笔记", ["./index"])
    assert.deepEqual(
      sanitizeAliases(content(home)).map((d) => [d.alias, d.reason]),
      [["./index", "site-owned"]],
    )
    assert.deepEqual(home.data.aliases, [])

    const deep = file("a/b/笔记", ["../index"])
    assert.deepEqual(
      sanitizeAliases(content(deep)).map((d) => [d.alias, d.reason]),
      [["../index", "escapes-output"]],
    )
  })

  test("撞名判定与插件同口径：index、空 slug、x/index 都等于同一页", () => {
    assert.equal(comparisonKey("index"), "")
    assert.equal(comparisonKey(""), "")
    assert.equal(comparisonKey("./"), "")
    assert.equal(comparisonKey("别处/index"), "别处")
    assert.equal(comparisonKey("/别处/笔记/"), "别处/笔记")
  })
})
