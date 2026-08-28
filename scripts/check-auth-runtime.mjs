import fs from "node:fs";
import path from "node:path";

const MAX_PBKDF2_ITERATIONS = 100_000;
const projectRoot = path.resolve(process.argv[2] ?? process.cwd());
const sourceDirectories = ["app", "src", "server", "worker", "functions", "lib"];
const ignoredDirectories = new Set([".git", ".next", ".vinext", ".wrangler", "dist", "node_modules"]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const forbiddenPatterns = [
  {
    expression: /\bcrypto\.subtle\.timingSafeEqual\b/g,
    message: "crypto.subtle.timingSafeEqual is not available in the Workers runtime; use a byte-wise constant-time comparison.",
  },
  {
    expression: /\bcrypto\.timingSafeEqual\b/g,
    message: "Node's crypto.timingSafeEqual is not available in the Workers runtime; use a byte-wise constant-time comparison.",
  },
  {
    expression: /(?:from\s*["']|require\(\s*["']|import\(\s*["'])node:crypto["']/g,
    message: "Node's crypto module is not available in the Workers runtime.",
  },
  {
    expression: /(?:from\s*["']|require\(\s*["']|import\(\s*["'])crypto["']/g,
    message: "Node's crypto module is not available in the Workers runtime.",
  },
];
const numericConstantPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\d[\d_]*)\b/g;
const iterationPropertyPattern = /\biterations\s*:\s*([^,\n}]+)/gi;

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

function numericLiteral(value) {
  if (!/^\d[\d_]*$/u.test(value)) return null;
  const number = Number(value.replaceAll("_", ""));
  return Number.isSafeInteger(number) ? number : null;
}

function withoutComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (comment) => " ".repeat(comment.length));
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

const files = sourceDirectories.flatMap((directory) => collectFiles(path.join(projectRoot, directory)));
const constants = new Map();
const contents = new Map();
const findings = [];

for (const file of files) {
  const content = withoutComments(fs.readFileSync(file, "utf8"));
  contents.set(file, content);
  numericConstantPattern.lastIndex = 0;
  let constantMatch;
  while ((constantMatch = numericConstantPattern.exec(content))) {
    const value = numericLiteral(constantMatch[2]);
    if (value !== null) constants.set(constantMatch[1], value);
  }
}

for (const file of files) {
  const content = contents.get(file);
  for (const pattern of forbiddenPatterns) {
    pattern.expression.lastIndex = 0;
    let match;
    while ((match = pattern.expression.exec(content))) {
      findings.push(`${path.relative(projectRoot, file)}:${lineNumber(content, match.index)} — ${pattern.message}`);
    }
  }

  if (!/\bPBKDF2\b/iu.test(content)) continue;
  iterationPropertyPattern.lastIndex = 0;
  let iterationMatch;
  while ((iterationMatch = iterationPropertyPattern.exec(content))) {
    const expression = iterationMatch[1]
      .replace(/\/\*.*?\*\//gs, "")
      .replace(/\/\/.*$/u, "")
      .trim();
    const identifier = /^([A-Za-z_$][\w$]*)$/u.exec(expression);
    const iterations = numericLiteral(expression) ?? (identifier ? constants.get(identifier[1]) ?? null : null);
    const location = `${path.relative(projectRoot, file)}:${lineNumber(content, iterationMatch.index)}`;
    if (iterations === null) {
      findings.push(`${location} — PBKDF2 iteration count must be a numeric literal or local numeric constant at or below ${MAX_PBKDF2_ITERATIONS}.`);
    } else if (iterations > MAX_PBKDF2_ITERATIONS) {
      findings.push(`${location} — PBKDF2 iteration counts above ${MAX_PBKDF2_ITERATIONS} are not supported by the Workers runtime.`);
    }
  }
}

if (findings.length) {
  console.error("Authentication runtime compatibility check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Authentication runtime compatibility check passed (${files.length} source files scanned).`);
