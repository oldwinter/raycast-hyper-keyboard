import os from "node:os";
import path from "node:path";
import { readdir, realpath } from "node:fs/promises";
import { macKeyCodeToLabel } from "../keycodes";
import type { ShortcutAssignment } from "../types";
import { jsonFilesByRecency, newestJsonFile, pathExists, readJsonFile } from "../lib/files";

interface RaycastCommand {
  id: string;
  extensionId: string;
  enabled?: boolean;
  macosHotkey?: {
    locality?: string;
    kind?: {
      shortcut?: {
        modifiers?: Array<{ modifier: string }>;
        key?: { code?: number };
      };
    };
  };
}

const HYPER_MODIFIERS = ["Alt", "Ctrl", "Meta", "Shift"];

const BUILTIN_COMMANDS: Array<{ needle: string; title: string; icon: string }> = [
  { needle: "c:r:clipboard-history", title: "Clipboard History", icon: "📋" },
  { needle: "c:r:emoji-picker", title: "Emoji Search", icon: "😀" },
  { needle: "c:r:file-search", title: "File Search", icon: "🔎" },
  { needle: "c:r:notes", title: "Raycast Notes", icon: "📝" },
  { needle: "c:r:snippets", title: "Raycast Snippets", icon: "✂️" },
  { needle: "c:r:browser", title: "Ask Browser", icon: "🌐" },
  { needle: "c:r:quicklinks", title: "Quicklink", icon: "↗️" },
  { needle: "c:r:ai", title: "AI Command", icon: "✨" },
];

export interface RaycastSnapshotSelection {
  snapshotPath?: string;
  skipped: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotCommands(value: unknown): unknown[] | undefined {
  if (!isRecord(value) || !isRecord(value.tables) || !Array.isArray(value.tables.commands)) return undefined;
  return value.tables.commands;
}

export function defaultRaycastSnapshotsDirectory(): string {
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "com.raycast.macos",
    "cloud-sync",
    "settings-snapshots",
  );
}

function isHyperCommand(value: unknown): value is RaycastCommand {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.extensionId !== "string") return false;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return false;
  if (!isRecord(value.macosHotkey) || value.macosHotkey.locality !== "Global") return false;
  if (!isRecord(value.macosHotkey.kind) || !isRecord(value.macosHotkey.kind.shortcut)) return false;
  const shortcut = value.macosHotkey.kind.shortcut;
  if (!Array.isArray(shortcut.modifiers) || !isRecord(shortcut.key) || typeof shortcut.key.code !== "number") {
    return false;
  }
  const modifiers = shortcut.modifiers
    .map((modifier) => (isRecord(modifier) && typeof modifier.modifier === "string" ? modifier.modifier : undefined))
    .filter((modifier): modifier is string => Boolean(modifier))
    .sort();
  return (
    value.enabled !== false &&
    modifiers.length === shortcut.modifiers.length &&
    JSON.stringify(modifiers) === JSON.stringify([...HYPER_MODIFIERS].sort()) &&
    Number.isFinite(shortcut.key.code)
  );
}

function applicationAssignment(
  command: RaycastCommand,
  key: string,
  snapshotPath: string,
): ShortcutAssignment | undefined {
  const marker = "::application::=::";
  const markerIndex = command.id.indexOf(marker);
  if (markerIndex === -1) return undefined;
  const rawAppPath = command.id.slice(markerIndex + marker.length).trim();
  if (!path.isAbsolute(rawAppPath)) return undefined;
  const appPath = path.normalize(rawAppPath);
  const extension = path.extname(appPath);
  const title = path.basename(appPath, extension).trim();
  if (extension.toLowerCase() !== ".app" || !title) return undefined;
  return {
    key,
    title,
    description: "Launch or toggle " + title,
    source: "raycast",
    sourcePath: snapshotPath,
    commandId: command.id,
    extensionId: command.extensionId,
    icon: { kind: "app", value: appPath },
    enabled: true,
  };
}

async function extensionIconPath(extensionDirectory: string, iconName: string | undefined): Promise<string | undefined> {
  if (!iconName || path.isAbsolute(iconName)) return undefined;
  try {
    const assetsDirectory = await realpath(path.resolve(extensionDirectory, "assets"));
    const candidate = await realpath(path.resolve(assetsDirectory, iconName));
    const relative = path.relative(assetsDirectory, candidate);
    if (!relative || relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

async function nodeExtensionAssignment(
  command: RaycastCommand,
  key: string,
  snapshotPath: string,
  extensionsDirectory: string,
): Promise<ShortcutAssignment | undefined> {
  const extensionUuid = command.extensionId.match(/^e:n:([0-9a-f-]+)$/i)?.[1];
  if (!extensionUuid) return undefined;
  const extensionDirectory = path.join(extensionsDirectory, extensionUuid);
  const manifestPath = path.join(extensionDirectory, "package.json");
  if (!(await pathExists(manifestPath))) return undefined;

  try {
    const manifest = await readJsonFile<unknown>(manifestPath);
    if (!isRecord(manifest)) return undefined;
    const commandName = command.id.split("::-::").at(-1);
    const manifestCommand = Array.isArray(manifest.commands)
      ? manifest.commands.find((candidate) => isRecord(candidate) && candidate.name === commandName)
      : undefined;
    const manifestTitle = typeof manifest.title === "string" ? manifest.title : undefined;
    const commandTitle =
      isRecord(manifestCommand) && typeof manifestCommand.title === "string" ? manifestCommand.title : undefined;
    const commandIcon =
      isRecord(manifestCommand) && typeof manifestCommand.icon === "string" ? manifestCommand.icon : undefined;
    const manifestIcon = typeof manifest.icon === "string" ? manifest.icon : undefined;
    const iconPath = await extensionIconPath(extensionDirectory, commandIcon ?? manifestIcon);

    return {
      key,
      title: commandTitle ?? manifestTitle ?? commandName ?? "Raycast Extension",
      description: manifestTitle ? manifestTitle + " extension command" : "Raycast extension command",
      source: "raycast",
      sourcePath: snapshotPath,
      commandId: command.id,
      extensionId: command.extensionId,
      icon: iconPath ? { kind: "file", value: iconPath } : { kind: "emoji", value: "🧩" },
      enabled: true,
    };
  } catch {
    return undefined;
  }
}

function builtinAssignment(command: RaycastCommand, key: string, snapshotPath: string): ShortcutAssignment {
  const definition = BUILTIN_COMMANDS.find(({ needle }) => command.id.startsWith(needle));
  return {
    key,
    title: definition?.title ?? "Raycast Command",
    description: "Raycast built-in command",
    source: "raycast",
    sourcePath: snapshotPath,
    commandId: command.id,
    extensionId: command.extensionId,
    icon: { kind: "emoji", value: definition?.icon ?? "🚀" },
    enabled: true,
  };
}

export async function parseRaycastSnapshot(
  snapshotPath: string,
  extensionsDirectory = path.join(os.homedir(), ".config", "raycast", "extensions"),
): Promise<ShortcutAssignment[]> {
  const snapshot = await readJsonFile<unknown>(snapshotPath);
  const commands = snapshotCommands(snapshot);
  if (!commands) throw new Error("Raycast snapshot does not contain tables.commands");

  const assignments = await Promise.all(
    commands.filter(isHyperCommand).map(async (command) => {
      const code = command.macosHotkey?.kind?.shortcut?.key?.code;
      const key = typeof code === "number" ? macKeyCodeToLabel(code) : undefined;
      if (!key) return undefined;
      return (
        applicationAssignment(command, key, snapshotPath) ??
        (await nodeExtensionAssignment(command, key, snapshotPath, extensionsDirectory)) ??
        builtinAssignment(command, key, snapshotPath)
      );
    }),
  );

  return assignments.filter((assignment): assignment is ShortcutAssignment => Boolean(assignment));
}

export async function findLatestRaycastSnapshot(directory: string): Promise<string | undefined> {
  if (!(await pathExists(directory))) return undefined;
  return newestJsonFile(directory);
}

export async function findUsableRaycastSnapshot(directory: string): Promise<RaycastSnapshotSelection> {
  if (!(await pathExists(directory))) return { skipped: [] };
  const skipped: string[] = [];
  for (const candidate of await jsonFilesByRecency(directory)) {
    try {
      const snapshot = await readJsonFile<unknown>(candidate);
      if (!snapshotCommands(snapshot)) throw new Error("missing tables.commands");
      return { snapshotPath: candidate, skipped };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push(path.basename(candidate) + ": " + message);
    }
  }
  return { skipped };
}

export async function listInstalledRaycastExtensionIds(
  extensionsDirectory = path.join(os.homedir(), ".config", "raycast", "extensions"),
): Promise<string[]> {
  if (!(await pathExists(extensionsDirectory))) return [];
  return (await readdir(extensionsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
