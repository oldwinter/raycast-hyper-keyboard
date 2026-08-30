import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCustomShortcuts } from "../src/data/custom";

describe("custom JSON parser", () => {
  it("normalizes keys and resolves relative icons", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-"));
    const configPath = path.join(directory, "shortcuts.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        shortcuts: [
          { key: "space", title: "Notes", icon: "📝", replace: false },
          { key: "q", title: "Queue", icon: "icons/q.png" },
        ],
      }),
    );

    const assignments = await parseCustomShortcuts(configPath);
    expect(assignments[0]).toMatchObject({ key: "Space", title: "Notes", replace: false, icon: { kind: "emoji", value: "📝" } });
    expect(assignments[1]).toMatchObject({ key: "Q", replace: true, icon: { kind: "file", value: path.join(directory, "icons/q.png") } });
  });

  it("rejects unsupported keys", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-invalid-"));
    const configPath = path.join(directory, "shortcuts.json");
    await writeFile(configPath, JSON.stringify({ version: 1, shortcuts: [{ key: "Escape", title: "Nope" }] }));
    await expect(parseCustomShortcuts(configPath)).rejects.toThrow("Unsupported key");
  });
});
