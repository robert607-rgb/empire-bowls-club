import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.argv[2] ?? process.cwd());
const sourceDirectories = ["app", "src", "server", "worker", "functions", "lib"];
const ignoredDirectories = new Set([".git", ".next", ".vinext", ".wrangler", "dist", "node_modules"]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const forbiddenPatterns = [
  {
    expression: /crypto\.subtle\.timingSafeEqual\s*\(/g,
    message: "crypto.subtle.timingSafeEqual is not available in the Workers runtime; use a byte-wise constant-time comparison.",
  },
  {
    expression: /crypto\.timingSafeEqual\s*\(/g,
    message: "Node's crypto.timingSafeEqual is not available in the Workers runtime; use a byte-wise constant-time comparison.",
  },
  {
    expression: /(?:from\s*["']|require\(\s*["'])node:crypto["']/g,
    message: "Node's crypto module is not available in the Workers runtime.",
  },
  {
    expression: /(?:from\s*["']|require\(\s*["'])crypto["']/g,
    message: "Node's crypto module is not available in the Workers runtime.",
  },
];
const iterationPattern = /iterations\s*:\s*(\d[\d_]*)/g;

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(path.join(directory, entry.name)));
      }
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const files = sourceDirectories.flatMap((directory) => collectFiles(path.join(projectRoot, directory)));
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    pattern.expression.lastIndex = 0;
    let match;
    while ((match = pattern.expression.exec(content))) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(`${path.relative(projectRoot, file)}:${line} — ${pattern.message}`);
    }
  }
  iterationPattern.lastIndex = 0;
  let iterationMatch;
  while ((iterationMatch = iterationPattern.exec(content))) {
    const iterations = Number(iterationMatch[1].replaceAll("_", ""));
    if (iterations > 100_000) {
      const line = content.slice(0, iterationMatch.index).split("\n").length;
      findings.push(`${path.relative(projectRoot, file)}:${line} — PBKDF2 iteration counts above 100000 are not supported by the Workers runtime.`);
    }
  }
}

if (findings.length) {
  console.error("Authentication runtime compatibility check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Authentication runtime compatibility check passed (${files.length} source files scanned).`);
