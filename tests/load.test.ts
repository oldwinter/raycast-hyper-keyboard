import { mkdtemp, mkdir, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadShortcutMap } from "../src/data/load";

function hyperHotkey(code: number) {
  return {
    locality: "Global",
    kind: {
      shortcut: {
        modifiers: ["Shift", "Ctrl", "Alt", "Meta"].map((modifier) => ({ modifier })),
        key: { code },
      },
    },
  };
}

describe("shortcut source merger", () => {
  it("merges semantic duplicates, applies custom overrides, and reports stale snapshots", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-loader-"));
    const snapshotsDirectory = path.join(root, "snapshots");
    await mkdir(snapshotsDirectory);
    const canvasPath = path.join(root, "hyper.canvas");
    await writeFile(
      canvasPath,
      JSON.stringify({
        nodes: [
          { id: "d", type: "text", text: "## D\n[[滴答清单]]", x: 0, y: 0, width: 160, height: 160 },
          { id: "six", type: "text", text: "## 6\nemoji 搜索", x: 200, y: 0, width: 160, height: 160 },
        ],
      }),
    );
    const snapshotPath = path.join(snapshotsDirectory, "snapshot.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        tables: {
          commands: [
            {
              id: "c:r:applications::*::application::=::/Applications/TickTick.app",
              extensionId: "e:r:applications",
              enabled: true,
              macosHotkey: hyperHotkey(2),
            },
            {
              id: "c:r:emoji-picker::-::searchEmoji",
              extensionId: "e:r:emoji-picker",
              enabled: true,
              macosHotkey: hyperHotkey(22),
            },
          ],
        },
      }),
    );
    const staleDate = new Date(Date.now() - 20 * 86_400_000);
    await utimes(snapshotPath, staleDate, staleDate);
    const customPath = path.join(root, "custom.json");
    await writeFile(
      customPath,
      JSON.stringify({ version: 1, shortcuts: [{ key: "D", title: "Do Something Else", icon: "✅" }] }),
    );

    const result = await loadShortcutMap({
      readCanvas: true,
      canvasPath,
      readRaycastSnapshots: true,
      raycastSnapshotsDirectory: snapshotsDirectory,
      customConfigPath: customPath,
      showUnassignedKeys: true,
    });

    expect(result.keys.get("6")?.assignments).toHaveLength(1);
    expect(result.keys.get("6")?.assignments[0]).toMatchObject({ title: "Emoji Search", source: "raycast" });
    expect(result.keys.get("D")?.assignments).toEqual([
      expect.objectContaining({ title: "Do Something Else", source: "custom" }),
    ]);
    expect(result.warnings).toContain(
      "The newest Raycast settings snapshot is 20 days old. Export fresh settings or check the snapshots directory in Extension Preferences.",
    );
  });

  it("skips Canvas when readCanvas is on but Canvas File is unset", async () => {
    const result = await loadShortcutMap({
      readCanvas: true,
      readRaycastSnapshots: false,
      showUnassignedKeys: true,
    });

    expect(result.sourceFiles).toEqual([]);
    expect(result.keys.size).toBe(0);
    expect(result.warnings.join("\n")).not.toMatch(/oldwinter-notes/);
  });

  it("warns only for an explicit missing Canvas File", async () => {
    const missing = path.join(os.tmpdir(), "hyper-missing-canvas", "map.canvas");
    const result = await loadShortcutMap({
      readCanvas: true,
      canvasPath: missing,
      readRaycastSnapshots: false,
      showUnassignedKeys: true,
    });

    expect(result.sourceFiles).toEqual([]);
    expect(result.warnings).toEqual([
      `Canvas file not found: ${missing}. Check the Canvas path in Extension Preferences.`,
    ]);
    expect(result.warnings.join("\n")).not.toMatch(/oldwinter-notes/);
  });
});
