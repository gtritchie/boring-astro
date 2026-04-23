// scripts/run-pa11y.mjs
// Reads sitemap-index.xml from the local preview, walks each shard (also
// fetched from the preview, NOT from production), collects every <loc>, and
// invokes pa11y-ci against that flat URL list. All URLs are rewritten to the
// preview origin so the audit validates the build under test — never the
// deployed site.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.PA11Y_BASE_URL ?? "http://127.0.0.1:4321";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  return res.text();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function toLocal(absoluteUrl) {
  const { pathname, search } = new URL(absoluteUrl);
  return `${base}${pathname}${search}`;
}

// Puppeteer's postinstall browser download is suppressed by
// ignore-scripts=true in .npmrc. Respect PUPPETEER_EXECUTABLE_PATH if
// the caller (CI) sets it; otherwise probe common system Chrome paths
// so local runs work without extra config.
function resolveChromePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

const indexXml = await fetchText(`${base}/sitemap-index.xml`);
const shardUrls = extractLocs(indexXml).map(toLocal);
if (shardUrls.length === 0) throw new Error("sitemap-index.xml contained no shards");

const pageUrls = [];
for (const shard of shardUrls) {
  const shardXml = await fetchText(shard);
  pageUrls.push(...extractLocs(shardXml).map(toLocal));
}
if (pageUrls.length === 0) throw new Error("no page URLs found across sitemap shards");

const cfg = JSON.parse(readFileSync(".pa11yci.json", "utf8"));
cfg.urls = pageUrls;

const chromePath = resolveChromePath();
if (chromePath) {
  cfg.defaults = cfg.defaults ?? {};
  cfg.defaults.chromeLaunchConfig = cfg.defaults.chromeLaunchConfig ?? {};
  cfg.defaults.chromeLaunchConfig.executablePath = chromePath;
}

mkdirSync(join(tmpdir(), "bbd"), { recursive: true });
const outPath = join(tmpdir(), "bbd", "pa11yci.json");
writeFileSync(outPath, JSON.stringify(cfg, null, 2));

console.log(
  `pa11y-ci: auditing ${pageUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}`,
);
if (chromePath) console.log(`pa11y-ci: using Chrome at ${chromePath}`);
else {
  console.warn(
    "pa11y-ci: no system Chrome found and PUPPETEER_EXECUTABLE_PATH not set — " +
      "falling back to puppeteer's bundled browser (only works if ~/.cache/puppeteer was populated before ignore-scripts took effect).",
  );
}

const result = spawnSync("npx", ["pa11y-ci", "--config", outPath], { stdio: "inherit" });
process.exit(result.status ?? 1);
