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
import { Launcher } from "chrome-launcher";

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
// ignore-scripts=true in .npmrc, so a Chrome binary must be provided
// another way:
//
//   1. PUPPETEER_EXECUTABLE_PATH — explicit override. If set, it MUST
//      point at a real file; we fail fast on a bad path rather than
//      silently falling back, which would mask typos and broken CI
//      action outputs.
//   2. chrome-launcher's Launcher.getInstallations() — cross-platform
//      discovery (handles macOS app bundles including user-local,
//      Linux incl. Snap/Flatpak, and Windows).
//   3. Nothing found → fail with an actionable message.
function resolveChromePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv !== undefined && fromEnv !== "") {
    if (!existsSync(fromEnv)) {
      throw new Error(
        `PUPPETEER_EXECUTABLE_PATH is set to "${fromEnv}" but no file exists there. ` +
          `Fix the path or unset the variable to auto-detect.`,
      );
    }
    return fromEnv;
  }
  const found = Launcher.getInstallations();
  if (found.length > 0) return found[0];
  throw new Error(
    "No Chrome installation found. Install Google Chrome/Chromium, " +
      "or set PUPPETEER_EXECUTABLE_PATH to a valid binary.",
  );
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
cfg.defaults = cfg.defaults ?? {};
cfg.defaults.chromeLaunchConfig = cfg.defaults.chromeLaunchConfig ?? {};
cfg.defaults.chromeLaunchConfig.executablePath = chromePath;

mkdirSync(join(tmpdir(), "bbd"), { recursive: true });
const outPath = join(tmpdir(), "bbd", "pa11yci.json");
writeFileSync(outPath, JSON.stringify(cfg, null, 2));

console.log(
  `pa11y-ci: auditing ${pageUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}`,
);
console.log(`pa11y-ci: using Chrome at ${chromePath}`);

const result = spawnSync("npx", ["pa11y-ci", "--config", outPath], { stdio: "inherit" });
process.exit(result.status ?? 1);
