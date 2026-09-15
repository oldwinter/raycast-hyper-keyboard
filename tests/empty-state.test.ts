import { describe, expect, it } from "vitest";
import { browseEmptyState } from "../src/lib/empty-state";

describe("browseEmptyState", () => {
  it("points at preferences when the keymap is empty", () => {
    const empty = browseEmptyState("");
    expect(empty.title).toBe("No shortcuts to show");
    expect(empty.description).toMatch(/Show unassigned keys/);
    expect(empty.description).toMatch(/Extension Preferences/);
  });

  it("treats whitespace-only search as an empty keymap", () => {
    expect(browseEmptyState("   ").title).toBe("No shortcuts to show");
  });

  it("asks for a different query when search has no matches", () => {
    const empty = browseEmptyState("xyz");
    expect(empty.title).toBe("No matching shortcuts");
    expect(empty.description).toMatch(/Try another/);
    expect(empty.description).not.toMatch(/Extension Preferences/);
  });
});
