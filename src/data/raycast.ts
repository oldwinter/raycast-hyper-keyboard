import os from "node:os";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { macKeyCodeToLabel } from "../keycodes";
import type { ShortcutAssignment } from "../types";
import { newestJsonFile, pathExists, readJsonFile } from "../lib/files";

interface RaycastSnapshot {
  tables?: {
    commands?: RaycastCommand[];
  };
}

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

interface ExtensionManifest {
  title?: string;
  icon?: string;
  commands?: Array<{ name?: string; title?: string; icon?: string }>;
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

function isHyperCommand(command: RaycastCommand): boolean {
  const shortcut = command.macosHotkey?.kind?.shortcut;
  const modifiers = shortcut?.modifiers?.map(({ modifier }) => modifier).sort() ?? [];
  return (
    command.enabled !== false &&
    command.macosHotkey?.locality === "Global" &&
    JSON.stringify(modifiers) === JSON.stringify([...HYPER_MODIFIERS].sort()) &&
    typeof shortcut?.key?.code === "number"
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
  const appPath = command.id.slice(markerIndex + marker.length);
  return {
    key,
    title: path.basename(appPath, path.extname(appPath)),
    description: `Launch or toggle ${path.basename(appPath, path.extname(appPath))}`,
    source: "raycast",
    sourcePath: snapshotPath,
    commandId: command.id,
    extensionId: command.extensionId,
    icon: { kind: "app", value: appPath },
    enabled: true,
  };
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

  const manifest = await readJsonFile<ExtensionManifest>(manifestPath);
  const commandName = command.id.split("::-::").at(-1);
  const manifestCommand = manifest.commands?.find((candidate) => candidate.name === commandName);
  const iconName = manifestCommand?.icon ?? manifest.icon;
  const iconPath = iconName ? path.join(extensionDirectory, "assets", iconName) : undefined;

  return {
    key,
    title: manifestCommand?.title ?? manifest.title ?? commandName ?? "Raycast Extension",
    description: manifest.title ? `${manifest.title} extension command` : "Raycast extension command",
    source: "raycast",
    sourcePath: snapshotPath,
    commandId: command.id,
    extensionId: command.extensionId,
    icon: iconPath ? { kind: "file", value: iconPath } : { kind: "emoji", value: "🧩" },
    enabled: true,
  };
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
  const snapshot = await readJsonFile<RaycastSnapshot>(snapshotPath);
  const commands = snapshot.tables?.commands;
  if (!Array.isArray(commands)) throw new Error("Raycast snapshot does not contain tables.commands");

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

export async function listInstalledRaycastExtensionIds(
  extensionsDirectory = path.join(os.homedir(), ".config", "raycast", "extensions"),
): Promise<string[]> {
  if (!(await pathExists(extensionsDirectory))) return [];
  return (await readdir(extensionsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
