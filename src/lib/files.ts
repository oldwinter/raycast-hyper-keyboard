import { existsSync } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function newestJsonFile(directory: string): Promise<string | undefined> {
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        return { filePath, modifiedAt: (await stat(filePath)).mtimeMs };
      }),
  );
  return candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.filePath;
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
