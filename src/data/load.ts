import { stat } from "node:fs/promises";
import { parseCanvasShortcuts } from "./canvas";
import { parseCustomShortcuts } from "./custom";
import { defaultRaycastSnapshotsDirectory, findLatestRaycastSnapshot, parseRaycastSnapshot } from "./raycast";
import type { Preferences, ShortcutAssignment, ShortcutMap } from "../types";
import { keyOrder } from "../layout";
import { pathExists } from "../lib/files";

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function semanticTitle(value: string): string {
  const normalized = comparable(value);
  if (/ticktick|滴答清单/.test(normalized)) return "ticktick";
  if (/clipboardhistory|raycastclipboard/.test(normalized)) return "clipboard";
  if (/emojisearch|emoji搜索/.test(normalized)) return "emoji";
  if (/searcharc|arc搜索/.test(normalized)) return "arcsearch";
  if (/aicommand|ai指令/.test(normalized)) return "aicommand";
  return normalized;
}

function titlesMatch(left: string, right: string): boolean {
  const a = comparable(left);
  const b = comparable(right);
  return (
    semanticTitle(left) === semanticTitle(right) ||
    a === b ||
    (a.length >= 3 && b.includes(a)) ||
    (b.length >= 3 && a.includes(b))
  );
}

function isGenericRaycastTitle(value: string): boolean {
  return ["Quicklink", "AI Command", "Raycast Command"].includes(value);
}

function addAssignment(map: Map<string, ShortcutAssignment[]>, assignment: ShortcutAssignment): void {
  const current = map.get(assignment.key) ?? [];
  const duplicate = current.some(
    (candidate) =>
      (assignment.commandId && candidate.commandId === assignment.commandId) ||
      (!assignment.commandId &&
        comparable(candidate.title) === comparable(assignment.title) &&
        candidate.source === assignment.source),
  );
  if (!duplicate) map.set(assignment.key, [...current, assignment]);
}

function mergeRaycastAssignment(map: Map<string, ShortcutAssignment[]>, raycast: ShortcutAssignment): void {
  const current = map.get(raycast.key) ?? [];
  if (
    isGenericRaycastTitle(raycast.title) &&
    current.some((candidate) => candidate.source === "raycast" && candidate.extensionId === raycast.extensionId)
  ) {
    return;
  }
  const canvasIndex = current.findIndex(
    (candidate) =>
      candidate.source === "canvas" &&
      (titlesMatch(candidate.title, raycast.title) || isGenericRaycastTitle(raycast.title)),
  );
  if (canvasIndex === -1) {
    addAssignment(map, raycast);
    return;
  }

  const canvas = current[canvasIndex];
  const merged: ShortcutAssignment = {
    ...raycast,
    title: isGenericRaycastTitle(raycast.title) ? canvas.title : raycast.title,
    description: canvas.description || raycast.description,
    icon: raycast.icon?.kind === "emoji" && canvas.icon ? canvas.icon : (raycast.icon ?? canvas.icon),
  };
  const next = [...current];
  next.splice(canvasIndex, 1, merged);
  map.set(raycast.key, next);
}

function dedupeAssignments(assignments: ShortcutAssignment[]): ShortcutAssignment[] {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    const identity = `${comparable(assignment.title)}:${assignment.icon?.kind ?? ""}:${assignment.icon?.value ?? ""}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function loadShortcutMap(preferences: Preferences): Promise<ShortcutMap> {
  const assignments = new Map<string, ShortcutAssignment[]>();
  const warnings: string[] = [];
  const sourceFiles: string[] = [];

  if (preferences.readCanvas && preferences.canvasPath) {
    const canvasPath = preferences.canvasPath;
    if (await pathExists(canvasPath)) {
      try {
        (await parseCanvasShortcuts(canvasPath)).forEach((assignment) => addAssignment(assignments, assignment));
        sourceFiles.push(canvasPath);
      } catch (error) {
        warnings.push(`Canvas: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push(
        `Canvas file not found: ${canvasPath}. Check the Canvas path in Extension Preferences.`,
      );
    }
  }

  if (preferences.readRaycastSnapshots) {
    const directory = preferences.raycastSnapshotsDirectory || defaultRaycastSnapshotsDirectory();
    try {
      const snapshotPath = await findLatestRaycastSnapshot(directory);
      if (snapshotPath) {
        (await parseRaycastSnapshot(snapshotPath)).forEach((assignment) =>
          mergeRaycastAssignment(assignments, assignment),
        );
        sourceFiles.push(snapshotPath);
        const ageInDays = Math.floor((Date.now() - (await stat(snapshotPath)).mtimeMs) / 86_400_000);
        if (ageInDays > 14)
          warnings.push(
            `The newest Raycast settings snapshot is ${ageInDays} days old. Export fresh settings or check the snapshots directory in Extension Preferences.`,
          );
      } else {
        warnings.push(
          "No Raycast settings snapshot was found. Export Raycast settings or disable snapshot import in Extension Preferences.",
        );
      }
    } catch (error) {
      warnings.push(`Raycast: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (preferences.customConfigPath) {
    try {
      const custom = await parseCustomShortcuts(preferences.customConfigPath);
      custom.forEach(({ replace, ...assignment }) => {
        if (replace) assignments.set(assignment.key, [assignment]);
        else addAssignment(assignments, assignment);
      });
      sourceFiles.push(preferences.customConfigPath);
    } catch (error) {
      warnings.push(`Custom JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const keys = new Map(
    [...assignments.entries()]
      .sort(([left], [right]) => keyOrder(left) - keyOrder(right))
      .map(([key, values]) => [key, { key, assignments: dedupeAssignments(values) }]),
  );

  return { keys, sourceFiles: [...new Set(sourceFiles)], warnings, loadedAt: new Date() };
}
