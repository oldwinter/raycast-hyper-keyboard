import path from "node:path";
import { normalizeKey } from "../layout";
import type { CustomShortcutConfig, IconReference, ShortcutAssignment } from "../types";
import { readJsonFile } from "../lib/files";

function iconReference(
  value: string | undefined,
  appPath: string | undefined,
  configPath: string,
): IconReference | undefined {
  if (appPath) return { kind: "app", value: appPath };
  if (!value) return undefined;
  if (/^https:\/\//i.test(value)) return { kind: "url", value };
  if (value.length <= 4 && !/[/.]/.test(value)) return { kind: "emoji", value };
  return { kind: "file", value: path.isAbsolute(value) ? value : path.resolve(path.dirname(configPath), value) };
}

export async function parseCustomShortcuts(
  configPath: string,
): Promise<Array<ShortcutAssignment & { replace: boolean }>> {
  const config = await readJsonFile<CustomShortcutConfig>(configPath);
  if (config.version !== 1 || !Array.isArray(config.shortcuts)) {
    throw new Error("Custom config must use version 1 and contain a shortcuts array");
  }

  return config.shortcuts.map((shortcut, index) => {
    const key = normalizeKey(shortcut.key);
    if (!key) throw new Error(`Unsupported key at shortcuts[${index}]: ${shortcut.key}`);
    if (!shortcut.title?.trim()) throw new Error(`Missing title at shortcuts[${index}]`);
    return {
      key,
      title: shortcut.title.trim(),
      description: shortcut.description?.trim(),
      source: "custom" as const,
      sourcePath: configPath,
      icon: iconReference(shortcut.icon, shortcut.appPath, configPath),
      enabled: true,
      replace: shortcut.replace !== false,
    };
  });
}
