import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@raycast/api", () => ({
  environment: { supportPath: "" },
  getPreferenceValues: () => ({}),
}));

import { loadShortcutMapState } from "../src/lib/use-shortcut-map";
import type { Preferences } from "../src/types";

const preferences: Preferences = {
  readRaycastSnapshots: false,
  readCanvas: false,
  showUnassignedKeys: false,
};

describe("loadShortcutMapState", () => {
  it("does not touch preview generation when previews are not requested", async () => {
    const supportPath = await mkdtemp(path.join(os.tmpdir(), "hyper-support-"));

    const result = await loadShortcutMapState(preferences, { previews: false, supportPath });

    expect(result.previews).toBeUndefined();
    expect(result.data.keys.size).toBe(0);
    expect(existsSync(path.join(supportPath, "preview"))).toBe(false);
  });

  it("generates preview files when previews are requested", async () => {
    const supportPath = await mkdtemp(path.join(os.tmpdir(), "hyper-support-"));

    const result = await loadShortcutMapState(preferences, { previews: true, supportPath });

    expect(result.previews).toBeDefined();
    if (!result.previews) return;
    expect(existsSync(result.previews.overviewPath)).toBe(true);
    expect(result.previews.zoomedPaths.every((zoomedPath) => existsSync(zoomedPath))).toBe(true);
    expect(result.data.warnings).toEqual([]);
  });

  it("still returns the keymap with a warning when preview generation fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-support-"));
    const fileBlockingSupportPath = path.join(root, "not-a-directory");
    await writeFile(fileBlockingSupportPath, "occupied");

    const result = await loadShortcutMapState(preferences, {
      previews: true,
      supportPath: fileBlockingSupportPath,
    });

    expect(result.previews).toBeUndefined();
    expect(result.data.keys.size).toBe(0);
    expect(result.data.warnings).toHaveLength(1);
    expect(result.data.warnings[0]).toMatch(/^Keyboard preview could not be generated: /);
    expect(result.data.warnings[0]).toMatch(/Refresh Keymap/);
  });
});
