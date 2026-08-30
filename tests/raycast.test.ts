import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRaycastSnapshot } from "../src/data/raycast";

function hotkey(code: number, modifiers = ["Shift", "Ctrl", "Alt", "Meta"]) {
  return {
    locality: "Global",
    kind: { shortcut: { modifiers: modifiers.map((modifier) => ({ modifier })), key: { code } } },
  };
}

describe("Raycast settings snapshot parser", () => {
  it("keeps enabled global Hyper commands and resolves app and extension icons", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-raycast-"));
    const extensionsDirectory = path.join(root, "extensions");
    const uuid = "606e26d8-b3c5-4760-8001-dccce1b872c4";
    await mkdir(path.join(extensionsDirectory, uuid, "assets"), { recursive: true });
    await writeFile(
      path.join(extensionsDirectory, uuid, "package.json"),
      JSON.stringify({
        title: "Arc",
        icon: "icon.png",
        commands: [{ name: "search", title: "Search Arc" }],
      }),
    );
    await writeFile(path.join(extensionsDirectory, uuid, "assets", "icon.png"), "icon");
    const snapshotPath = path.join(root, "snapshot.json");
    await writeFile(
      snapshotPath,
      JSON.stringify({
        tables: {
          commands: [
            {
              id: "c:r:applications::*::application::=::/Applications/Arc.app",
              extensionId: "e:r:applications",
              enabled: true,
              macosHotkey: hotkey(0),
            },
            {
              id: `c:n:${uuid}::-::search`,
              extensionId: `e:n:${uuid}`,
              enabled: true,
              macosHotkey: hotkey(19),
            },
            {
              id: "c:r:emoji-picker::-::searchEmoji",
              extensionId: "e:r:emoji-picker",
              enabled: true,
              macosHotkey: hotkey(22),
            },
            {
              id: "not-hyper",
              extensionId: "e:r:ignored",
              enabled: true,
              macosHotkey: hotkey(1, ["Meta"]),
            },
            {
              id: "disabled",
              extensionId: "e:r:ignored",
              enabled: false,
              macosHotkey: hotkey(2),
            },
          ],
        },
      }),
    );

    const assignments = await parseRaycastSnapshot(snapshotPath, extensionsDirectory);
    expect(assignments).toHaveLength(3);
    expect(assignments[0]).toMatchObject({ key: "A", title: "Arc", icon: { kind: "app", value: "/Applications/Arc.app" } });
    expect(assignments[1]).toMatchObject({ key: "2", title: "Search Arc" });
    expect(assignments[2]).toMatchObject({ key: "6", title: "Emoji Search", icon: { kind: "emoji", value: "😀" } });
  });
});
