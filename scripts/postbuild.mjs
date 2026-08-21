// Next.js standalone output does not include .next/static or public/.
// Without them the server boots but every CSS/JS chunk and static file 404s.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("[postbuild] .next/standalone missing — is output:'standalone' set in next.config.mjs?");
  process.exit(1);
}

const copies = [
  { from: join(root, ".next", "static"), to: join(standalone, ".next", "static") },
  { from: join(root, "public"), to: join(standalone, "public") },
];

for (const { from, to } of copies) {
  if (!existsSync(from)) {
    console.warn(`[postbuild] skip (not found): ${from}`);
    continue;
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[postbuild] copied ${from} -> ${to}`);
}

console.log("[postbuild] standalone bundle ready");
