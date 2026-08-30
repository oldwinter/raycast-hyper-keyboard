import { describe, expect, it } from "vitest";
import { macKeyCodeToLabel } from "../src/keycodes";
import { normalizeKey } from "../src/layout";

describe("mac key codes", () => {
  it("maps the key codes used by the current Hyper layout", () => {
    expect(macKeyCodeToLabel(0)).toBe("A");
    expect(macKeyCodeToLabel(19)).toBe("2");
    expect(macKeyCodeToLabel(36)).toBe("Enter");
    expect(macKeyCodeToLabel(44)).toBe("/");
    expect(macKeyCodeToLabel(49)).toBe("Space");
    expect(macKeyCodeToLabel(122)).toBe("F1");
    expect(macKeyCodeToLabel(111)).toBe("F12");
    expect(macKeyCodeToLabel(999)).toBeUndefined();
  });

  it("normalizes Canvas aliases without accepting arbitrary keys", () => {
    expect(normalizeKey("。")).toBe(".");
    expect(normalizeKey("；")).toBe(";");
    expect(normalizeKey("enter")).toBe("Enter");
    expect(normalizeKey("spacebar")).toBe("Space");
    expect(normalizeKey("Escape")).toBeUndefined();
  });
});
