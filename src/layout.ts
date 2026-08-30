export interface KeyboardRow {
  id: string;
  title: string;
  keys: string[];
  offset?: number;
}

export const KEYBOARD_ROWS: KeyboardRow[] = [
  { id: "function", title: "Function", keys: Array.from({ length: 12 }, (_, index) => `F${index + 1}`) },
  { id: "numbers", title: "Number", keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
  { id: "top", title: "QWERTY", keys: "QWERTYUIOP".split(""), offset: 40 },
  { id: "home", title: "Home", keys: [..."ASDFGHJKL".split(""), ";", "Enter"], offset: 72 },
  { id: "bottom", title: "Bottom", keys: [..."ZXCVBNM".split(""), ",", ".", "/"], offset: 120 },
  { id: "space", title: "Space", keys: ["Space"], offset: 590 },
];

export const PHYSICAL_KEYS = new Set(KEYBOARD_ROWS.flatMap((row) => row.keys));

const KEY_ALIASES: Record<string, string> = {
  "。": ".",
  "；": ";",
  return: "Enter",
  enter: "Enter",
  spacebar: "Space",
  space: "Space",
};

export function normalizeKey(input: string): string | undefined {
  const trimmed = input.trim();
  const alias = KEY_ALIASES[trimmed.toLowerCase()] ?? KEY_ALIASES[trimmed];
  const normalized = alias ?? (trimmed.length === 1 ? trimmed.toUpperCase() : trimmed.toUpperCase());
  if (/^F(?:[1-9]|1[0-2])$/.test(normalized)) return normalized;
  if (PHYSICAL_KEYS.has(normalized)) return normalized;
  return undefined;
}

export function keyOrder(key: string): number {
  const flattened = KEYBOARD_ROWS.flatMap((row) => row.keys);
  const index = flattened.indexOf(key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
