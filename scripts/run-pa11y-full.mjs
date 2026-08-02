// scripts/run-pa11y-full.mjs
// One command for the full local pa11y flow: build → start `astro preview` →
// wait until it serves → run the WCAG AAA audit → tear the server down.
// `npm run pa11y` on its own audits an already-running server; this wrapper
// owns the build and the server's lifecycle so there is nothing to start or
// stop by hand. Node built-ins only — no new dependency.
//
// The server is `astro preview`, not `wrangler dev` (`npm run preview`) — pa11y
// targets the Astro preview origin, and the two listen on different ports.
// `base` mirrors run-pa11y.mjs (PA11Y_BASE_URL, default :4321); the preview is
// started bound to that host/port so the server, the readiness poll, and the
// audit all target one origin. POSIX-only: teardown signals the preview's
// process group, which Windows lacks.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const rawBase = process.env.PA11Y_BASE_URL ?? "http://127.0.0.1:4321";
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;

// This wrapper binds astro preview to the exact origin it then polls and
// audits, and the local preview is HTTP-only, so an override must be an http://
// URL with an explicit port. Reject anything else up front rather than starting
// a server the poll can never reach (e.g. https, or a portless URL whose
// default port differs from the preview's). The default base satisfies this.
let origin;
try {
  origin = new URL(rawBase);
} catch {
  console.error(`run-pa11y-full: PA11Y_BASE_URL is not a valid URL: "${rawBase}".`);
  process.exit(1);
}
if (origin.protocol !== "http:" || origin.port === "") {
  console.error(
    `run-pa11y-full: PA11Y_BASE_URL must be an http:// URL with an explicit port ` +
      `(e.g. http://127.0.0.1:4322); got "${rawBase}". Use the manual pa11y flow for anything else.`,
  );
  process.exit(1);
}
const { hostname, port } = origin;
// Use the bare origin everywhere: `${base}/…` is built by string concatenation
// (here and in run-pa11y), so a stray path/query/fragment on the override would
// corrupt those URLs. Hand the normalized value to the child audit via the env
// so both processes agree on one origin.
const base = origin.origin;
process.env.PA11Y_BASE_URL = base;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1;
}

// 1. Refuse to start if something already holds the port. `astro preview` does
// NOT use strict-port mode: on a collision it prints "Port N is in use, trying
// another one…" and binds N+1. The readiness poll and the audit both target the
// requested port, so without this check a stray server there would be audited
// instead of the build under test — silently, and with a green result. Checked
// before the build so a collision fails in a second rather than after one.
async function assertPortFree() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (err) =>
      reject(
        err.code === "EADDRINUSE"
          ? new Error(
              `${hostname}:${port} is already in use — stop whatever is listening there ` +
                `(likely a stray \`npm run preview:astro\`) and re-run.`,
            )
          : err,
      ),
    );
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(Number(port), hostname);
  });
}

try {
  await assertPortFree();
} catch (err) {
  console.error(`run-pa11y-full: ${err.message}`);
  process.exit(1);
}

// 2. Build — pa11y walks the sitemap of the freshly built dist/client, so a
// stale or missing build must not be audited.
const buildStatus = run("npm", ["run", "build"]);
if (buildStatus !== 0) {
  console.error("run-pa11y-full: build failed; aborting.");
  process.exit(buildStatus);
}

// 3. Start the preview bound to `base`'s host/port, in its own process group
// (detached) so teardown can signal the npx wrapper and astro together. Binding
// the same origin we poll and audit keeps a PA11Y_BASE_URL override coherent.
console.log(`run-pa11y-full: starting preview server at ${base} …`);
const preview = spawn("npx", ["astro", "preview", "--host", hostname, "--port", port], {
  stdio: "ignore",
  detached: true,
});

let previewExited = false;
preview.on("exit", () => {
  previewExited = true;
});

function stopPreview() {
  if (previewExited || preview.pid === undefined) return;
  try {
    // Negative pid → signal the whole group (npx → astro).
    process.kill(-preview.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

// Tear the server down if the run is interrupted, not just on the happy path.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopPreview();
    process.exit(130);
  });
}

// 4. Wait until the preview is actually serving — it takes a moment to boot,
// and pa11y fails fast if it races ahead.
async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (previewExited) {
      throw new Error(
        "preview server exited before it was ready — run `npm run preview:astro` on its own to see why.",
      );
    }
    try {
      if ((await fetch(`${base}/`)).ok) return;
    } catch {
      // Not up yet; keep polling.
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `preview server did not become ready at ${base} within ${READY_TIMEOUT_MS / 1000}s.`,
  );
}

try {
  await waitForReady();
} catch (err) {
  console.error(`run-pa11y-full: ${err.message}`);
  stopPreview();
  process.exit(1);
}

// 5. Audit the live preview, then always tear it down.
const auditStatus = run("npm", ["run", "pa11y"]);
stopPreview();
process.exit(auditStatus);
