import { describe, expect, it } from "vitest";
import {
  browseWarningItems,
  loadErrorMarkdown,
  missingCanvasFileWarning,
  showKeyboardMarkdown,
  warningDetailMarkdown,
} from "../src/lib/load-status";

describe("load status copy", () => {
  it("points at preferences and refresh when load fails", () => {
    const markdown = loadErrorMarkdown("browse", "EACCES: permission denied");
    expect(markdown).toContain("Unable to load shortcuts");
    expect(markdown).toContain("EACCES: permission denied");
    expect(markdown).toMatch(/Extension Preferences/);
    expect(markdown).toMatch(/Refresh Keymap/);
    expect(loadErrorMarkdown("show", "bad json")).toContain("Unable to load Hyper Keyboard");
  });

  it("lists collected warnings under the keyboard image", () => {
    const markdown = showKeyboardMarkdown({
      image: "![Hyper Keyboard](preview.png)",
      warnings: ["Canvas file not found: /tmp/missing.canvas", "No Raycast settings snapshot was found"],
    });
    expect(markdown.startsWith("![Hyper Keyboard](preview.png)")).toBe(true);
    expect(markdown).toContain("## Source warnings");
    expect(markdown).toContain("Canvas file not found: /tmp/missing.canvas");
    expect(markdown).toContain("No Raycast settings snapshot was found");
    expect(markdown).toMatch(/Extension Preferences/);
    expect(markdown).toMatch(/Refresh Keymap/);
  });

  it("keeps the reading placeholder when there is no image or warning", () => {
    expect(showKeyboardMarkdown({ warnings: [] })).toBe("# Hyper Keyboard\n\nReading your configured shortcuts…");
  });

  it("turns each warning into a browse row with a next step", () => {
    const items = browseWarningItems(["The newest Raycast settings snapshot is 20 days old"]);
    expect(items).toEqual([
      {
        title: "The newest Raycast settings snapshot is 20 days old",
        subtitle: "Open Extension Preferences or Refresh Keymap",
      },
    ]);
    expect(warningDetailMarkdown(items[0].title)).toMatch(/Refresh Keymap/);
  });

  it("uses the same missing-file warning for default and explicit Canvas paths", () => {
    expect(missingCanvasFileWarning("/Users/me/oldwinter-notes/map.canvas")).toBe(
      "Canvas file not found: /Users/me/oldwinter-notes/map.canvas",
    );
  });
});
