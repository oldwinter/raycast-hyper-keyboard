import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCanvasShortcuts } from "../src/data/canvas";

describe("Canvas shortcut parser", () => {
  it("extracts keys, wiki labels, notes, and the nearest image", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyper-canvas-"));
    const canvasDirectory = path.join(root, "Atlas", "Canvas");
    const imageDirectory = path.join(root, "Extras", "Images");
    await mkdir(canvasDirectory, { recursive: true });
    await mkdir(imageDirectory, { recursive: true });
    await writeFile(path.join(imageDirectory, "arc.png"), "not-a-real-image");
    const canvasPath = path.join(canvasDirectory, "hyper.canvas");
    await writeFile(
      canvasPath,
      JSON.stringify({
        nodes: [
          { id: "a", type: "text", text: "## A\n[[Arc浏览器|Arc]]\n浏览器", x: 0, y: 0, width: 160, height: 160 },
          { id: "icon", type: "file", file: "Extras/Images/arc.png", x: 85, y: 12, width: 60, height: 60 },
          { id: "period", type: "text", text: "## 。\nai command：语法检查", x: 400, y: 0, width: 160, height: 160 },
          { id: "empty", type: "text", text: "## L\n", x: 800, y: 0, width: 160, height: 160 },
        ],
      }),
    );

    const assignments = await parseCanvasShortcuts(canvasPath);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({ key: "A", title: "Arc", description: "Arc\n浏览器" });
    expect(assignments[0].icon).toEqual({ kind: "file", value: path.join(imageDirectory, "arc.png") });
    expect(assignments[1]).toMatchObject({ key: ".", title: "ai command：语法检查" });
  });
});
