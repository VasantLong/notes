import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"

const run = promisify(execFile)

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
/** 构建产物落在仓库外：既不留垃圾，也不进 pi-lens 的扫描面。 */
export const tmpDir = path.join(os.tmpdir(), "notes-garden-tests")

const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx")

/** Build a garden vault into an output dir with the repo's quartz.config.yaml. */
export async function buildSite(opts: { contentDir: string; outDir: string }): Promise<string> {
  await fs.rm(opts.outDir, { recursive: true, force: true })
  const { stdout } = await run(
    tsx,
    ["./quartz/bootstrap-cli.mjs", "build", "-d", opts.contentDir, "-o", opts.outDir],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
  )
  return stdout
}

export async function listArtifacts(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      out.push(path.relative(dir, full))
    }
  }
  await walk(dir)
  return out.sort()
}

/** Every text artifact (html/css/js/json/xml/txt/cname) as path → content. */
export async function readTextArtifacts(dir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const rel of await listArtifacts(dir)) {
    if (!/\.(html|css|js|json|xml|txt)$/i.test(rel) && rel !== "CNAME") continue
    map.set(rel, await fs.readFile(path.join(dir, rel), "utf8"))
  }
  return map
}

/** 命名空间/规范标识符，永远不会被浏览器取回。 */
const NON_FETCH_HOSTS = new Set([
  "www.w3.org",
  "www.sitemaps.org",
  "schema.org",
  "purl.org",
  "creativecommons.org",
])

/**
 * 浏览器会真的去取的第三方地址：link/script/img/iframe/source 的 href|src、CSS url()/@import，
 * 以及 JS 里作为字符串字面量出现的绝对 URL（插件会把 CDN 地址硬编码进脚本）。
 * `<a href>` 只是链接不是请求，故 html 里先剥掉锚点标签再扫。
 */
export function externalResourceUrls(
  artifact: string,
  opts: { kind?: "html" | "code"; ownHost?: string } = {},
): string[] {
  const kind = opts.kind ?? (/<html|<head|<body/i.test(artifact) ? "html" : "code")
  const text = kind === "html" ? artifact.replace(/<a\b[^>]*>/gi, "<a>") : artifact
  const ownHost = opts.ownHost?.toLowerCase()

  const patterns = [
    /<(?:link|script|img|iframe|source|embed|audio|video)\b[^>]*?\b(?:href|src)\s*=\s*"([^"]+)"/gi,
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
    /@import\s+(?:url\()?\s*['"]?([^'";]+)/gi,
    /["'`](https?:\/\/[^"'`\s)]+)["'`]/gi,
  ]

  const urls: string[] = []
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) urls.push(m[1])
  }

  return urls.filter((u) => {
    if (!/^(https?:)?\/\//i.test(u)) return false
    const host = u
      .replace(/^(https?:)?\/\//i, "")
      .split("/")[0]
      .toLowerCase()
    if (ownHost && host === ownHost) return false
    return !NON_FETCH_HOSTS.has(host)
  })
}
