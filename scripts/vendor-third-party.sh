#!/usr/bin/env bash
# 自托管第三方运行时库（规格故事 29：产物不请求任何第三方域名）。
# 版本必须与上游插件里硬编码的 CDN 版本一致，映射表见 quartz/util/self-host.ts。
set -euo pipefail

KATEX_VERSION=0.16.11   # @quartz-community/latex 硬编码的版本
D3_VERSION=7.9.2        # @quartz-community/graph 用 d3@7
PIXI_VERSION=8.23.0     # @quartz-community/graph 用 pixi.js@8

repo_root=$(cd "$(dirname "$0")/.." && pwd)
vendor_dir="$repo_root/quartz/static/vendor"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

npm pack --pack-destination "$work" \
  "katex@$KATEX_VERSION" "d3@$D3_VERSION" "pixi.js@$PIXI_VERSION" >/dev/null

# 每个包单独解到自己的目录：三个 tarball 的顶层都叫 package/，混解会互相覆盖。
for pkg in katex d3 pixi.js; do
  mkdir -p "$work/$pkg"
  tar -xzf "$work/$pkg"-*.tgz -C "$work/$pkg"
done

mkdir -p "$vendor_dir/katex/fonts"
cp "$work"/katex/package/dist/katex.min.css "$vendor_dir/katex/katex.min.css"
cp "$work"/katex/package/dist/contrib/copy-tex.min.js "$vendor_dir/katex/copy-tex.min.js"
cp "$work"/katex/package/dist/fonts/*.woff2 "$vendor_dir/katex/fonts/"
cp "$work"/d3/package/dist/d3.min.js "$vendor_dir/d3.min.js"
cp "$work"/pixi.js/package/dist/pixi.min.js "$vendor_dir/pixi.min.js"

# pixi 里那段 CDN 地址是压缩纹理转码器（basis/ktx）的基地址，向量图谱永远用不到；
# 改成指向本地空目录，好让「产物不含第三方地址」这条断言不需要任何例外名单。
sed -i 's#https://cdn.jsdelivr.net/npm/pixi.js/transcoders/#/static/vendor/pixi-transcoders/#g' \
  "$vendor_dir/pixi.min.js"

# 只留 woff2：KaTeX CSS 默认还列了 woff/ttf，留着就会指向不存在的文件。
# 目标浏览器（safari 15.6+ / chrome 109+ / firefox 102+）全都支持 woff2。
sed -i -E 's#,url\(fonts/[A-Za-z0-9_-]+\.woff\) format\("woff"\),url\(fonts/[A-Za-z0-9_-]+\.ttf\) format\("truetype"\)##g' \
  "$vendor_dir/katex/katex.min.css"

if grep -qE 'url\(fonts/[^)]+\.(woff|ttf)\)' "$vendor_dir/katex/katex.min.css"; then
  echo "KaTeX CSS 里还残留非 woff2 字体引用" >&2
  exit 1
fi

echo "vendored: katex $KATEX_VERSION, d3 $D3_VERSION, pixi.js $PIXI_VERSION -> quartz/static/vendor/"
du -sh "$vendor_dir"
