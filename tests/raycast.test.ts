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

async function writeSnapshot(root: string, commands: unknown[]): Promise<string> {
  const snapshotPath = path.join(root, "snapshot.json");
  await writeFile(snapshotPath, JSON.stringify({ tables: { commands } }));
  return snapshotPath;
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
    expect(assignments[0]).toMatchObject({
      key: "A",
      title: "Arc",
      icon: { kind: "app", value: "/Applications/Arc.app" },
    });
    expect(assignments[1]).toMatchObject({ key: "2", title: "Search Arc" });
    expect(assignments[2]).toMatchObject({ key: "6", title: "Emoji Search", icon: { kind: "emoji", value: "😀" } });
  });

  it("skips malformed command records without losing valid assignments", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-raycast-schema-"));
    const snapshotPath = await writeSnapshot(root, [
      null,
      7,
      { id: "missing-extension", macosHotkey: hotkey(1) },
      {
        id: "c:r:emoji-picker::-::searchEmoji",
        extensionId: "e:r:emoji-picker",
        enabled: true,
        macosHotkey: hotkey(0),
      },
    ]);

    await expect(parseRaycastSnapshot(snapshotPath, path.join(root, "extensions"))).resolves.toEqual([
      expect.objectContaining({ key: "A", title: "Emoji Search" }),
    ]);
  });

  it("creates app icon references only for absolute application bundles", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-raycast-app-path-"));
    const paths = ["", "relative/Foo.app", "/tmp/not-an-app.txt", "/Applications/Valid.APP"];
    const snapshotPath = await writeSnapshot(
      root,
      paths.map((appPath, index) => ({
        id: "c:r:applications::*::application::=::" + appPath,
        extensionId: "e:r:applications",
        enabled: true,
        macosHotkey: hotkey(index),
      })),
    );

    const assignments = await parseRaycastSnapshot(snapshotPath, path.join(root, "extensions"));
    expect(assignments).toHaveLength(4);
    expect(assignments.slice(0, 3).map((assignment) => assignment.icon)).toEqual([
      { kind: "emoji", value: "🚀" },
      { kind: "emoji", value: "🚀" },
      { kind: "emoji", value: "🚀" },
    ]);
    expect(assignments[3]).toMatchObject({
      title: "Valid",
      icon: { kind: "app", value: "/Applications/Valid.APP" },
    });
  });

  it("confines extension icons to the extension assets directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-raycast-assets-"));
    const extensionsDirectory = path.join(root, "extensions");
    const uuid = "606e26d8-b3c5-4760-8001-dccce1b872c4";
    const assetsDirectory = path.join(extensionsDirectory, uuid, "assets");
    await mkdir(path.join(assetsDirectory, "nested"), { recursive: true });
    await writeFile(path.join(assetsDirectory, "nested", "icon.png"), "icon");
    await writeFile(
      path.join(extensionsDirectory, uuid, "package.json"),
      JSON.stringify({
        title: "Example",
        commands: [
          { name: "escape", title: "Escape", icon: "../../outside.png" },
          { name: "absolute", title: "Absolute", icon: "/tmp/outside.png" },
          { name: "nested", title: "Nested", icon: "nested/icon.png" },
        ],
      }),
    );
    const snapshotPath = await writeSnapshot(root, [
      {
        id: "c:n:" + uuid + "::-::escape",
        extensionId: "e:n:" + uuid,
        enabled: true,
        macosHotkey: hotkey(0),
      },
      {
        id: "c:n:" + uuid + "::-::absolute",
        extensionId: "e:n:" + uuid,
        enabled: true,
        macosHotkey: hotkey(1),
      },
      {
        id: "c:n:" + uuid + "::-::nested",
        extensionId: "e:n:" + uuid,
        enabled: true,
        macosHotkey: hotkey(2),
      },
    ]);

    const assignments = await parseRaycastSnapshot(snapshotPath, extensionsDirectory);
    expect(assignments[0].icon).toEqual({ kind: "emoji", value: "🧩" });
    expect(assignments[1].icon).toEqual({ kind: "emoji", value: "🧩" });
    expect(assignments[2].icon).toEqual({
      kind: "file",
      value: path.join(assetsDirectory, "nested", "icon.png"),
    });
  });

  it("falls back per command when an extension manifest is malformed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-raycast-manifest-"));
    const extensionsDirectory = path.join(root, "extensions");
    const uuid = "606e26d8-b3c5-4760-8001-dccce1b872c4";
    await mkdir(path.join(extensionsDirectory, uuid), { recursive: true });
    await writeFile(path.join(extensionsDirectory, uuid, "package.json"), "{truncated");
    const snapshotPath = await writeSnapshot(root, [
      {
        id: "c:n:" + uuid + "::-::broken",
        extensionId: "e:n:" + uuid,
        enabled: true,
        macosHotkey: hotkey(0),
      },
      {
        id: "c:r:emoji-picker::-::searchEmoji",
        extensionId: "e:r:emoji-picker",
        enabled: true,
        macosHotkey: hotkey(1),
      },
    ]);

    const assignments = await parseRaycastSnapshot(snapshotPath, extensionsDirectory);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({ title: "Raycast Command", icon: { kind: "emoji", value: "🚀" } });
    expect(assignments[1]).toMatchObject({ title: "Emoji Search", icon: { kind: "emoji", value: "😀" } });
  });
});
