import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteNode = path.join(root, "node_modules", ".bin", "vite-node");
const script = path.join(root, "scripts", "render-current.ts");

if (!existsSync(viteNode)) {
  console.error("error: vite-node is not installed");
  console.error("try: npm run deps");
  process.exit(2);
}

const result = spawnSync(viteNode, [script, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
