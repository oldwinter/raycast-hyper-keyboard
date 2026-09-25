import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("npm run preview next step", () => {
  it("points preview at the wrapper and keeps deps outside lint/test", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(pkg.scripts.preview, "node scripts/preview.mjs");
    assert.match(pkg.scripts.deps, /vite-node/);
    assert.doesNotMatch(pkg.scripts.preview, /vite-node/);
    assert.doesNotMatch(JSON.stringify(pkg.devDependencies ?? {}), /vite-node/);
  });

  it("exits 2 with try: npm run deps when the local vite-node bin is missing", () => {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "preview.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /error: vite-node is not installed/);
    assert.match(result.stderr, /try: npm run deps/);
    assert.doesNotMatch(result.stderr, /vite-node: not found/);
  });
});
