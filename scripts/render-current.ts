import path from "node:path";
import { loadShortcutMap } from "../src/data/load";
import { generateKeyboardPreview } from "../src/lib/preview";

const outputDirectory = path.resolve(process.argv[2] ?? "evidence/current-preview");
const shortcutMap = await loadShortcutMap({
  readRaycastSnapshots: true,
  readCanvas: true,
  showUnassignedKeys: true,
});
const previews = await generateKeyboardPreview(shortcutMap, outputDirectory);
const conflicts = [...shortcutMap.keys.values()]
  .filter((item) => item.assignments.length > 1)
  .map((item) => ({ key: item.key, titles: item.assignments.map((assignment) => assignment.title) }));

console.log(
  JSON.stringify(
    {
      previews,
      assignedKeys: shortcutMap.keys.size,
      conflicts,
      sources: shortcutMap.sourceFiles,
      warnings: shortcutMap.warnings,
    },
    null,
    2,
  ),
);
