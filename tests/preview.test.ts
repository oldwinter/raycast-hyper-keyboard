import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderKeyboardSvg } from "../src/lib/preview";
import type { ShortcutMap } from "../src/types";

describe("keyboard preview", () => {
  it("renders the complete keyboard and conflict state", async () => {
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-"));
    const iconPath = path.join(iconDirectory, "arc.png");
    await writeFile(
      iconPath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const map: ShortcutMap = {
      keys: new Map([
        [
          "A",
          {
            key: "A",
            assignments: [
              { key: "A", title: "Arc", source: "raycast", icon: { kind: "file", value: iconPath } },
              { key: "A", title: "Another Arc", source: "custom", icon: { kind: "emoji", value: "A" } },
            ],
          },
        ],
      ]),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const svg = await renderKeyboardSvg(map, iconDirectory);
    expect(svg).toContain("Hyper Keyboard");
    expect(svg).toContain("1 mapped · 1 conflicts");
    expect(svg).toContain("Arc");
    expect(svg).toContain(">F12<");
    expect(svg).toContain(">Space<");
    expect(svg).toContain('width="54" height="54"');
    expect(svg).not.toContain("Unassigned");
  });

  it("falls back to the keyboard emoji for an unparseable Canvas link icon URL", async () => {
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-"));
    const map: ShortcutMap = {
      keys: new Map([
        [
          "B",
          {
            key: "B",
            assignments: [
              {
                key: "B",
                title: "Broken Icon",
                source: "canvas",
                icon: { kind: "url", value: "icons/app.png" },
              },
            ],
          },
        ],
      ]),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const svg = await renderKeyboardSvg(map, iconDirectory);

    expect(svg).toContain("Broken Icon");
    expect(svg).toContain("⌨️");
  });

  it("renders a cropped viewport for the zoomed presentation", async () => {
    const map: ShortcutMap = {
      keys: new Map(),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-"));
    const svg = await renderKeyboardSvg(map, iconDirectory, { x: 740, y: 0, width: 1000, height: 900 });

    expect(svg).toContain('width="1000" height="900" viewBox="740 0 1000 900"');
  });
});
