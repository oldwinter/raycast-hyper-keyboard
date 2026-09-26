import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

it("builds into dist without changing generated declarations", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "hyper-build-"));
  try {
    for (const entry of ["package.json", "tsconfig.json", "raycast-env.d.ts", "src", "assets"]) {
      await cp(path.join(root, entry), path.join(fixture, entry), { recursive: true });
    }
    await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");
    // Keep Raycast's default config/output paths isolated from the user's installation.
    const preload = path.join(fixture, "isolate-home.cjs");
    await writeFile(preload, `require("node:os").homedir = () => ${JSON.stringify(fixture)};\n`);
    const declarations = await readFile(path.join(fixture, "raycast-env.d.ts"), "utf8");
    const manifest = JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8"));

    execFileSync("npm", ["run", "build"], {
      cwd: fixture,
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(preload)}`,
      },
      timeout: 30_000,
      stdio: "pipe",
    });

    for (const command of manifest.commands) {
      expect((await stat(path.join(fixture, "dist", `${command.name}.js`))).size).toBeGreaterThan(0);
    }
    const output = JSON.parse(await readFile(path.join(fixture, "dist", "package.json"), "utf8"));
    expect(output.name).toBe(manifest.name);
    expect(await readFile(path.join(fixture, "raycast-env.d.ts"), "utf8")).toBe(declarations);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 40_000);
