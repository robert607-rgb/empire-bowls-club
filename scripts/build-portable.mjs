import { access, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();

// Retain the existing isolated, bounded Sites workflow on its Linux host.
if (process.platform !== "win32") {
  const result = spawnSync("bash", ["scripts/build-verified.sh"], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Windows has no guaranteed bash or GNU timeout. Run the same checks and Sites
// build directly with Node, keeping the Cloudflare production target separate.
const runtime = path.join(root, ".sites-runtime");
await Promise.all(["tmp", "wrangler/logs", "registry"].map(dir => mkdir(path.join(runtime, dir), { recursive: true })));
const env = {
  ...process.env,
  SITES_ENV_READY: "1",
  SITES_PROJECT_ROOT: root,
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: path.join(runtime, "wrangler", "logs"),
  MINIFLARE_REGISTRY_PATH: path.join(runtime, "registry"),
  TMPDIR: path.join(runtime, "tmp"),
};
delete env.CLOUDFLARE_TARGET_BUILD;

function run(args, timeout) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit", timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["scripts/check-auth-runtime.mjs", root]);
run(["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]);
console.log("Running bounded Sites build...");
run(["node_modules/vinext/dist/cli.js", "build"], 180_000);

const workerPath = path.join(root, "dist", "server", "index.js");
const hostingPath = path.join(root, "dist", ".openai", "hosting.json");
await access(workerPath);
const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
const sourceHosting = JSON.parse(await readFile(path.join(root, ".openai", "hosting.json"), "utf8"));
if (hosting.project_id !== sourceHosting.project_id || hosting.d1 !== sourceHosting.d1 || hosting.r2 !== sourceHosting.r2) {
  throw new Error("The Sites artifact does not match this project's hosting configuration.");
}
const worker = await import(`${pathToFileURL(workerPath).href}?sites-validation=${Date.now()}`);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must export a Worker fetch handler.");
}
console.log("Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.");
