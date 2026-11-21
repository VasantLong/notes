import { describe, test } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { parse as parseYaml } from "yaml"
import { repoRoot } from "./helpers/build.ts"

/**
 * 票 10 的接缝：workflow 文件本身就是交付物。
 *
 * 断言的是"流水线的形状"——触发条件、步骤次序、缓存钥匙、部署接线——而不是 YAML 的写法。
 * 「日期来自 git」这一条在 test/deploy-dates.test.ts 的构建测试里验证（产物面），
 * 这里只校验 checkout 取全量历史这条前提。
 */

const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy.yml")

interface Step {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  "continue-on-error"?: boolean
}

interface Job {
  needs?: string[] | string
  if?: string
  steps: Step[]
  environment?: unknown
  permissions?: Record<string, string>
}

interface Workflow {
  on: Record<string, unknown>
  permissions?: Record<string, string>
  concurrency?: { group?: string; "cancel-in-progress"?: boolean }
  jobs: Record<string, Job>
}

const loadWorkflow = async (): Promise<Workflow> => {
  const raw = await fs.readFile(workflowPath, "utf8")
  return parseYaml(raw) as Workflow
}

/** 步骤的可观察身份：uses 动作或 run 命令，二者必有其一。 */
const stepLabel = (step: Step) => step.uses ?? step.run?.trim().split("\n")[0] ?? step.name ?? "?"

const indexOfStep = (steps: Step[], match: (step: Step, label: string) => boolean) =>
  steps.findIndex((step) => match(step, stepLabel(step)))

const stepMatching = (steps: Step[], match: (step: Step, label: string) => boolean): Step => {
  const index = indexOfStep(steps, match)
  assert.ok(index >= 0, "workflow 里找不到步骤：" + match.toString())
  return steps[index]
}

describe("CI：推 main 就上线", () => {
  test("workflow 由 main 的 push 触发", async () => {
    const wf = await loadWorkflow()
    const push = wf.on?.push as { branches?: string[] } | undefined
    assert.ok(push, "workflow 必须由 push 触发")
    assert.deepEqual(push.branches, ["main"])
  })

  test("手工触发只建不部署：deploy job 限定 push 且 ref 是 main", async () => {
    const wf = await loadWorkflow()
    assert.ok("workflow_dispatch" in wf.on, "缺手工触发开关：没有它就只能靠合 main 来验构建段")
    assert.equal(wf.jobs.build.if, undefined, "build job 不该有条件：任何触发都要先建出产物")

    const gate = String(wf.jobs.deploy.if ?? "")
    assert.match(gate, /github\.event_name\s*==\s*'push'/, "deploy 只跟 push 走")
    assert.match(
      gate,
      /github\.ref\s*==\s*'refs\/heads\/main'/,
      "deploy 只认 main：手工触发分支时不许上线",
    )
  })

  test("checkout 取全量历史（fetch-depth 0）：日期溯源的前提", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps
    const checkout = stepMatching(steps, (step) =>
      Boolean(step.uses?.startsWith("actions/checkout@")),
    )
    assert.equal(checkout.with?.["fetch-depth"], 0, "浅克隆会让所有条目回落 mtime")
  })

  test("步骤次序固定：装依赖 → 装插件 → 字段校验 → 构建 → 上传 → 部署", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps

    const npmCi = indexOfStep(steps, (_s, label) => /^npm ci\b/.test(label))
    const installPlugins = indexOfStep(steps, (_s, label) => /plugin install/.test(label))
    const validate = indexOfStep(steps, (_s, label) => label.includes("check:entries"))
    const build = indexOfStep(steps, (_s, label) => /quartz build/.test(label))
    const upload = indexOfStep(steps, (step) =>
      Boolean(step.uses?.startsWith("actions/upload-pages-artifact@")),
    )

    for (const [name, index] of Object.entries({
      npmCi,
      installPlugins,
      validate,
      build,
      upload,
    })) {
      assert.ok(index >= 0, "缺步骤 " + name)
    }
    assert.ok(npmCi < installPlugins, "先装依赖再装插件")
    assert.ok(installPlugins < validate, "插件装好才校验")
    assert.ok(validate < build, "字段校验必须在构建之前：坏条目进不了产物")
    assert.ok(build < upload, "构建产物才能上传")

    const deployJob = wf.jobs.deploy
    assert.ok(deployJob, "缺 deploy job")
    assert.deepEqual(
      Array.isArray(deployJob.needs) ? deployJob.needs : [deployJob.needs],
      ["build"],
      "部署在构建成功之后",
    )
    assert.ok(
      deployJob.steps.some((step) => step.uses?.startsWith("actions/deploy-pages@")),
      "deploy job 必须走 deploy-pages",
    )
  })

  test("校验失败即失败：没有任何步骤吞掉错误", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps
    for (const step of steps) {
      assert.notEqual(step["continue-on-error"], true, stepLabel(step) + " 不允许吞错误")
    }
    const validate = stepMatching(steps, (_s, label) => label.includes("check:entries"))
    assert.ok(!validate.run?.includes("|| true"), "校验步骤不允许 || true")
    assert.ok(!validate.run?.includes("|| exit 0"), "校验步骤不允许 || exit 0")
    for (const step of steps) {
      assert.equal(
        (step as { if?: unknown }).if,
        undefined,
        stepLabel(step) + " 不允许带 if：条件是另一种吞错误的形状",
      )
    }
  })

  test("npm 与插件目录两级缓存，key 取锁文件哈希", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps

    const npmCache = stepMatching(
      steps,
      (step) =>
        Boolean(step.uses?.startsWith("actions/cache@")) &&
        String(step.with?.path ?? "")
          .split("\n")
          .some((p) => p.trim() === "~/.npm"),
    )
    assert.match(
      String(npmCache.with?.key),
      /hashFiles\(\s*'package-lock\.json'\s*,\s*'\.node-version'\s*\)/,
      "npm 缓存 key 必须取 package-lock.json 与 .node-version 的哈希",
    )

    const pluginCache = stepMatching(
      steps,
      (step) =>
        Boolean(step.uses?.startsWith("actions/cache@")) &&
        String(step.with?.path ?? "")
          .split("\n")
          .some((p) => p.trim().replace(/\/$/, "") === ".quartz/plugins"),
    )
    assert.match(
      String(pluginCache.with?.key),
      /hashFiles\(\s*'package-lock\.json'\s*,\s*'quartz\.lock\.json'\s*,\s*'quartz\.config\.yaml'\s*\)/,
      "插件目录缓存 key 必须连 quartz.lock.json 一起算：只改锁定的插件版本时 key 也要变",
    )

    // 缓存恢复必须发生在安装之前，否则等于白存
    const npmCi = indexOfStep(steps, (_s, label) => /^npm ci\b/.test(label))
    assert.ok(steps.indexOf(npmCache) < npmCi, "npm 缓存要在 npm ci 之前恢复")
    const installPlugins = indexOfStep(steps, (_s, label) => /plugin install/.test(label))
    assert.ok(steps.indexOf(pluginCache) < installPlugins, "插件缓存要在装插件之前恢复")
  })

  test("依赖安装可复现：用 npm ci，不用 npm install", async () => {
    const wf = await loadWorkflow()
    const runs = wf.jobs.build.steps.map((step) => step.run ?? "").join("\n")
    assert.match(runs, /npm ci/)
    assert.ok(!/npm\s+(i|install)\b/.test(runs), "CI 里不允许 npm install / npm i：锁文件会漂")
  })

  test("上传的产物是 Quartz 的输出目录，部署走 Pages 官方动作", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps
    const upload = stepMatching(steps, (step) =>
      Boolean(step.uses?.startsWith("actions/upload-pages-artifact@")),
    )
    assert.equal(upload.with?.path, "public")

    assert.equal(wf.permissions?.pages, "write", "部署 Pages 需要 pages: write")
    assert.equal(wf.permissions?.["id-token"], "write", "deploy-pages 需要 id-token: write")
    const deployJob = wf.jobs.deploy
    assert.deepEqual((deployJob.environment as { name?: string })?.name, "github-pages")
    assert.ok(wf.concurrency?.group, "并发组避免两次部署互相覆盖")
    assert.equal(
      wf.concurrency?.["cancel-in-progress"],
      false,
      "排队不取消：取消会把半截产物留在线上",
    )
  })

  test("Node 版本与本地一致：读 .node-version", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps
    const node = stepMatching(steps, (step) =>
      Boolean(step.uses?.startsWith("actions/setup-node@")),
    )
    assert.equal(node.with?.["node-version-file"], ".node-version")
  })
})

describe("CI：测试接进流水线（票 12）", () => {
  test("分支上的改动也跑构建：pull_request 触发存在，且 base 是 main", async () => {
    const wf = await loadWorkflow()
    const pr = wf.on?.pull_request as { branches?: string[] } | undefined
    assert.ok(pr, "缺 pull_request 触发：分支上的坏改动只能等合进 main 才发现")
    assert.deepEqual(pr.branches, ["main"])
  })

  test("构建 job 跑 test/ 下的测试，且在上传产物之前", async () => {
    const wf = await loadWorkflow()
    const steps = wf.jobs.build.steps
    const testStep = indexOfStep(steps, (_step, label) => /npm test|tsx --test/.test(label))
    assert.ok(testStep >= 0, "构建 job 必须跑 test/ 下的测试：服务端今天从不执行它们")

    const upload = indexOfStep(steps, (step) =>
      Boolean(step.uses?.startsWith("actions/upload-pages-artifact@")),
    )
    assert.ok(upload >= 0)
    assert.ok(testStep < upload, "测试要在上传产物之前跑")
  })

  test("跑测试不改变上线闸门：deploy 仍只跟 push main 走", async () => {
    const wf = await loadWorkflow()
    const gate = String(wf.jobs.deploy.if ?? "")
    assert.match(gate, /github\.event_name\s*==\s*'push'/)
    assert.match(gate, /github\.ref\s*==\s*'refs\/heads\/main'/)
  })
})
