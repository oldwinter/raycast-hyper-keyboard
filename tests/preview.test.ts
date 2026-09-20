import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderKeyboardSvg } from "../src/lib/preview";
import type { ShortcutMap } from "../src/types";

describe("keyboard preview", () => {
  it("renders the complete keyboard and conflict state", async () => {
    const map: ShortcutMap = {
      keys: new Map([
        [
          "A",
          {
            key: "A",
            assignments: [
              { key: "A", title: "Arc", source: "raycast", icon: { kind: "emoji", value: "🌐" } },
              { key: "A", title: "Another Arc", source: "custom", icon: { kind: "emoji", value: "A" } },
            ],
          },
        ],
      ]),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-"));
    const svg = await renderKeyboardSvg(map, iconDirectory);
    expect(svg).toContain("Hyper Keyboard");
    expect(svg).toContain("1 assigned · 1 conflicts");
    expect(svg).toContain("Arc");
    expect(svg).toContain(">F12<");
    expect(svg).toContain(">Space<");
  });

  it("keeps the keyboard and shortcut visible when an icon URL is malformed", async () => {
    const map: ShortcutMap = {
      keys: new Map([
        [
          "A",
          {
            key: "A",
            assignments: [
              { key: "A", title: "Arc", source: "canvas", icon: { kind: "url", value: "not a valid image.png" } },
            ],
          },
        ],
      ]),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-"));
    const svg = await renderKeyboardSvg(map, iconDirectory);
    expect(svg).toContain("Hyper Keyboard");
    expect(svg).toContain("1 assigned · 0 conflicts");
    expect(svg).toContain(">Arc</text>");
    expect(svg).toContain(">F12<");
    expect(svg).toContain(">Space<");
    expect(svg).toContain('class="emoji">⌨️</text>');
  });

  it("falls back to a keyboard emoji when a shortcut icon URL is malformed", async () => {
    const map: ShortcutMap = {
      keys: new Map([
        [
          "B",
          {
            key: "B",
            assignments: [
              { key: "B", title: "Broken Icon", source: "canvas", icon: { kind: "url", value: "not a url" } },
            ],
          },
        ],
      ]),
      sourceFiles: [],
      warnings: [],
      loadedAt: new Date("2026-08-31T00:00:00Z"),
    };
    const iconDirectory = await mkdtemp(path.join(os.tmpdir(), "hyper-preview-bad-url-"));
    const svg = await renderKeyboardSvg(map, iconDirectory);
    expect(svg).toContain("Broken Icon");
    expect(svg).toContain("⌨️");
  });
});
