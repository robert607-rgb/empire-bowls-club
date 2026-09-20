import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env, CLOUDFLARE_TARGET_BUILD: "1" };

const authCheck = spawnSync(process.execPath, ["scripts/check-auth-runtime.mjs", root], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (authCheck.error) throw authCheck.error;
if (authCheck.status !== 0) process.exit(authCheck.status ?? 1);

const vinext = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "vinext.cmd")
  : path.join(root, "node_modules", ".bin", "vinext");
await access(vinext);
const build = spawnSync(vinext, ["build"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const workerPath = path.join(root, "dist", "server", "index.js");
const hostingPath = path.join(root, "dist", ".openai", "hosting.json");
await access(workerPath);
JSON.parse(await readFile(hostingPath, "utf8"));
const worker = await import(`${pathToFileURL(workerPath).href}?cloudflare-validation=${Date.now()}`);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must export a Worker fetch handler.");
}
console.log("Validated Cloudflare artifact: Worker entrypoint and Sites manifest are present.");
