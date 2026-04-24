// scripts/run-pa11y.mjs
// Reads sitemap-index.xml from the local preview, walks each shard (also
// fetched from the preview, NOT from production), collects every <loc>, and
// invokes pa11y-ci against that flat URL list. All URLs are rewritten to the
// preview origin so the audit validates the build under test — never the
// deployed site.
//
// Browser discovery: pa11y uses Puppeteer, which resolves its bundled
// Chrome for Testing automatically when executablePath is unset.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

mkdirSync(join(tmpdir(), "bbd"), { recursive: true });
const outPath = join(tmpdir(), "bbd", "pa11yci.json");
writeFileSync(outPath, JSON.stringify(cfg, null, 2));

console.log(
  `pa11y-ci: auditing ${pageUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}`,
);

const result = spawnSync("npx", ["pa11y-ci", "--config", outPath], { stdio: "inherit" });
process.exit(result.status ?? 1);
