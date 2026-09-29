import path from "node:path";
import { normalizeKey } from "../layout";
import type { CustomShortcutConfig, IconReference, ShortcutAssignment } from "../types";
import { readJsonFile } from "../lib/files";

type CustomShortcut = CustomShortcutConfig["shortcuts"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, field: string, index: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("shortcuts[" + index + "]." + field + " must be a string");
  return value;
}

function validateShortcut(value: unknown, index: number): CustomShortcut {
  if (!isRecord(value)) throw new Error("shortcuts[" + index + "] must be an object");
  if (typeof value.key !== "string") throw new Error("shortcuts[" + index + "].key must be a string");
  if (typeof value.title !== "string") throw new Error("shortcuts[" + index + "].title must be a string");
  if (value.replace !== undefined && typeof value.replace !== "boolean") {
    throw new Error("shortcuts[" + index + "].replace must be a boolean");
  }
  return {
    key: value.key,
    title: value.title,
    description: optionalString(value.description, "description", index),
    icon: optionalString(value.icon, "icon", index),
    appPath: optionalString(value.appPath, "appPath", index),
    replace: value.replace,
  };
}

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
  const config = await readJsonFile<unknown>(configPath);
  if (!isRecord(config) || config.version !== 1 || !Array.isArray(config.shortcuts)) {
    throw new Error("Custom config must use version 1 and contain a shortcuts array");
  }

  return config.shortcuts.map((value, index) => {
    const shortcut = validateShortcut(value, index);
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
