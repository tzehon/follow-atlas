import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const self = path.relative(root, fileURLToPath(import.meta.url));
const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);

const forbiddenTrackedPaths = [
  /(?:^|\/)\.env(?:\.|$)/,
  /(?:^|\/)\.dev\.vars(?:\.|$)/,
  /(?:^|\/)\.wrangler\//,
  /\.(?:db|sqlite|sqlite3|zip|pem|key|p12|pfx)$/i,
  /(?:^|\/)(?:data|imports|exports|account_information|followers_and_following)\//i,
  /(?:^|\/)following\.(?:json|html)$/i,
];

const contentRules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["OpenAI-style key", /sk-[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["Slack token", /xox[baprs]-[0-9A-Za-z-]{20,}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["machine-specific user path", /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/],
  ["live Sites project ID", /appgprj_[A-Za-z0-9_-]{12,}/],
];

const binaryExtensions = new Set([
  ".gif", ".ico", ".jpeg", ".jpg", ".png", ".ttf", ".webp", ".woff", ".woff2",
]);
const findings = [];

for (const file of tracked) {
  if (!existsSync(path.join(root, file))) continue;
  if (forbiddenTrackedPaths.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: private runtime/import file is tracked`);
  }
  if (file === self || binaryExtensions.has(path.extname(file).toLowerCase())) continue;

  const content = readFileSync(path.join(root, file), "utf8");
  for (const [label, pattern] of contentRules) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Repository safety audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Repository safety audit passed (${tracked.length} tracked files checked).`);
}
