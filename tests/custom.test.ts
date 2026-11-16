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
    expect(assignments[0]).toMatchObject({
      key: "Space",
      title: "Notes",
      replace: false,
      icon: { kind: "emoji", value: "📝" },
    });
    expect(assignments[1]).toMatchObject({
      key: "Q",
      replace: true,
      icon: { kind: "file", value: path.join(directory, "icons/q.png") },
    });
  });

  it.each([
    "👨‍💻",
    "🏳️‍🌈",
    "👨‍👩‍👧",
    "👩🏽‍💻",
    "🇺🇸",
    "🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}",
    "1️⃣",
  ])("recognizes emoji icon %s", async (icon) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-emoji-"));
    const configPath = path.join(directory, "shortcuts.json");
    await writeFile(configPath, JSON.stringify({ version: 1, shortcuts: [{ key: "q", title: "Queue", icon }] }));

    const [assignment] = await parseCustomShortcuts(configPath);
    expect(assignment.icon).toEqual({ kind: "emoji", value: icon });
  });

  it.each(["./x.png", "icons/q.png", "/tmp/q.png", "👨‍💻.png", "👨‍💻-icon", "icon", "123"])(
    "resolves file icon %s",
    async (icon) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-file-"));
      const configPath = path.join(directory, "shortcuts.json");
      await writeFile(configPath, JSON.stringify({ version: 1, shortcuts: [{ key: "q", title: "Queue", icon }] }));

      const [assignment] = await parseCustomShortcuts(configPath);
      expect(assignment.icon).toEqual({ kind: "file", value: path.resolve(directory, icon) });
    },
  );

  it("rejects unsupported keys", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-invalid-"));
    const configPath = path.join(directory, "shortcuts.json");
    await writeFile(configPath, JSON.stringify({ version: 1, shortcuts: [{ key: "Escape", title: "Nope" }] }));
    await expect(parseCustomShortcuts(configPath)).rejects.toThrow("Unsupported key");
  });

  it("reports indexed schema errors for malformed entries", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-custom-schema-"));
    const configPath = path.join(directory, "shortcuts.json");
    await writeFile(configPath, JSON.stringify({ version: 1, shortcuts: [{ key: "A", title: "Valid" }, null] }));
    await expect(parseCustomShortcuts(configPath)).rejects.toThrow("shortcuts[1] must be an object");

    await writeFile(
      configPath,
      JSON.stringify({ version: 1, shortcuts: [{ key: "A", title: "Invalid", description: 7 }] }),
    );
    await expect(parseCustomShortcuts(configPath)).rejects.toThrow("shortcuts[0].description must be a string");
  });
});
