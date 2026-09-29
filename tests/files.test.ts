import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newestJsonFile, readJsonFile } from "../src/lib/files";

describe("JSON file utilities", () => {
  it("uses the filename as a deterministic tie-breaker for equal mtimes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-files-"));
    const olderName = path.join(directory, "a.json");
    const newerName = path.join(directory, "z.json");
    await writeFile(olderName, "{}");
    await writeFile(newerName, "{}");
    const tied = new Date("2026-09-29T00:00:00Z");
    await utimes(olderName, tied, tied);
    await utimes(newerName, tied, tied);

    expect(await newestJsonFile(directory)).toBe(newerName);
  });

  it("rejects a file above the configured byte limit before parsing", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hyper-files-limit-"));
    const filePath = path.join(directory, "large.json");
    await writeFile(filePath, JSON.stringify({ ok: true }));

    await expect(readJsonFile(filePath, { maxBytes: 4 })).rejects.toThrow(/4-byte limit/);
  });
});
