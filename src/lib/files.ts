import { existsSync } from "node:fs";
import { access, open, readdir, stat } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MAX_JSON_BYTES = 16 * 1024 * 1024;

export interface ReadJsonOptions {
  maxBytes?: number;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string, options: ReadJsonOptions = {}): Promise<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("JSON byte limit must be a positive integer");

  const handle = await open(filePath, "r");
  try {
    const { size } = await handle.stat();
    if (size > maxBytes) {
      throw new Error("JSON file exceeds the " + maxBytes + "-byte limit: " + filePath + " (" + size + " bytes)");
    }
    return JSON.parse(await handle.readFile({ encoding: "utf8" })) as T;
  } finally {
    await handle.close();
  }
}

export async function jsonFilesByRecency(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        return { filePath, fileName: entry.name, modifiedAt: (await stat(filePath)).mtimeMs };
      }),
  );
  return candidates
    .sort(
      (left, right) =>
        right.modifiedAt - left.modifiedAt ||
        (left.fileName < right.fileName ? 1 : left.fileName > right.fileName ? -1 : 0),
    )
    .map(({ filePath }) => filePath);
}

export async function newestJsonFile(directory: string): Promise<string | undefined> {
  return (await jsonFilesByRecency(directory))[0];
}

export function resolveRelativeToAncestor(sourcePath: string, relativePath: string): string | undefined {
  let directory = path.dirname(sourcePath);
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, relativePath);
    if (existsSync(candidate)) return candidate;
    directory = path.dirname(directory);
  }
  return undefined;
}
