import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { KEYBOARD_ROWS } from "../layout";
import type { IconReference, ShortcutAssignment, ShortcutMap } from "../types";

const execFileAsync = promisify(execFile);

interface RenderedIcon {
  dataUri?: string;
  emoji?: string;
}

interface RowGeometry {
  y: number;
  height: number;
  keyWidth: number;
  gap: number;
}

const WIDTH = 1880;
const HEIGHT = 950;

const ROW_GEOMETRY: Record<string, RowGeometry> = {
  function: { y: 132, height: 92, keyWidth: 132, gap: 12 },
  numbers: { y: 250, height: 112, keyWidth: 142, gap: 12 },
  top: { y: 386, height: 112, keyWidth: 142, gap: 12 },
  home: { y: 522, height: 112, keyWidth: 142, gap: 12 },
  bottom: { y: 658, height: 112, keyWidth: 142, gap: 12 },
  space: { y: 794, height: 106, keyWidth: 650, gap: 12 },
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return entities[character];
  });
}

function truncateToPixels(value: string, maxPixels: number, fontSize: number): string {
  let pixels = 0;
  let result = "";
  for (const character of value) {
    const characterPixels = (character.codePointAt(0) ?? 0) <= 0xff ? fontSize * 0.54 : fontSize;
    if (pixels + characterPixels > maxPixels - fontSize * 0.6) return `${result}…`;
    pixels += characterPixels;
    result += character;
  }
  return result;
}

function displayDescription(assignment: ShortcutAssignment | undefined): string {
  if (!assignment?.description) return assignment ? "Hyper shortcut" : "";
  const title = assignment.title.toLowerCase().replace(/\s+/g, "");
  const usefulLines = assignment.description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase().replace(/\s+/g, "") !== title);
  return usefulLines.join(" · ") || "Hyper shortcut";
}

function mimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".svg":
      return "image/svg+xml";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

async function fileDataUri(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  return `data:${mimeType(filePath)};base64,${contents.toString("base64")}`;
}

async function appIconPath(appPath: string, iconDirectory: string): Promise<string | undefined> {
  const digest = createHash("sha1").update(appPath).digest("hex").slice(0, 12);
  const cachedPath = path.join(iconDirectory, `${digest}.png`);
  try {
    await readFile(cachedPath);
    return cachedPath;
  } catch {
    // Generate a Finder-quality application icon below.
  }

  const resourcesDirectory = path.join(appPath, "Contents", "Resources");
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/plutil",
      ["-extract", "CFBundleIconFile", "raw", "-o", "-", path.join(appPath, "Contents", "Info.plist")],
      { timeout: 2_000 },
    );
    const configuredName = stdout.trim();
    const configuredPath = path.join(
      resourcesDirectory,
      configuredName.endsWith(".icns") ? configuredName : `${configuredName}.icns`,
    );
    const candidates = [
      configuredPath,
      ...(await readdir(resourcesDirectory))
        .filter((name) => name.endsWith(".icns"))
        .map((name) => path.join(resourcesDirectory, name)),
    ];
    const iconPath = candidates.find(existsSync);
    if (!iconPath) return undefined;
    await execFileAsync("/usr/bin/sips", ["-s", "format", "png", iconPath, "--out", cachedPath], { timeout: 4_000 });
    return cachedPath;
  } catch {
    return undefined;
  }
}

async function remoteIconPath(url: string, iconDirectory: string): Promise<string | undefined> {
  const digest = createHash("sha1").update(url).digest("hex").slice(0, 12);
  const extension = path.extname(new URL(url).pathname) || ".png";
  const cachedPath = path.join(iconDirectory, `${digest}${extension}`);
  try {
    await readFile(cachedPath);
    return cachedPath;
  } catch {
    // Fetch the public Canvas image once and keep it in Raycast's support directory.
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return undefined;
    await writeFile(cachedPath, Buffer.from(await response.arrayBuffer()));
    return cachedPath;
  } catch {
    return undefined;
  }
}

async function renderIcon(icon: IconReference | undefined, iconDirectory: string): Promise<RenderedIcon> {
  if (!icon) return {};
  if (icon.kind === "emoji") return { emoji: icon.value };
  const filePath =
    icon.kind === "app"
      ? await appIconPath(icon.value, iconDirectory)
      : icon.kind === "url"
        ? await remoteIconPath(icon.value, iconDirectory)
        : icon.value;
  if (!filePath) return { emoji: "⌨️" };
  try {
    return { dataUri: await fileDataUri(filePath) };
  } catch {
    return { emoji: "⌨️" };
  }
}

function sourceColor(source: ShortcutAssignment["source"] | undefined): string {
  if (source === "raycast") return "#53b7f5";
  if (source === "custom") return "#66d18f";
  if (source === "canvas") return "#b998ff";
  return "#59616d";
}

function keyWidth(key: string, geometry: RowGeometry): number {
  if (key === "Enter") return 178;
  if (key === "Space") return 650;
  return geometry.keyWidth;
}

function renderKey(
  key: string,
  x: number,
  geometry: RowGeometry,
  assignment: ShortcutAssignment | undefined,
  assignmentCount: number,
  icon: RenderedIcon,
): string {
  const width = keyWidth(key, geometry);
  const assigned = Boolean(assignment);
  const hasIcon = Boolean(icon.dataUri || icon.emoji);
  const border = assignmentCount > 1 ? "#ff6b6b" : assigned ? "#f4b400" : "#3a4049";
  const fill = assigned ? "#1d2025" : "#17191d";
  const title = assignment ? truncateToPixels(assignment.title, width - 28, 16) : "Unassigned";
  const description = truncateToPixels(displayDescription(assignment), width - 28, 12);
  const iconMarkup = icon.dataUri
    ? `<image href="${icon.dataUri}" x="${x + width - 55}" y="${geometry.y + 12}" width="41" height="41" preserveAspectRatio="xMidYMid meet"/>`
    : icon.emoji
      ? `<text x="${x + width - 34}" y="${geometry.y + 45}" text-anchor="middle" class="emoji">${escapeXml(icon.emoji)}</text>`
      : "";
  const conflict =
    assignmentCount > 1
      ? `<rect x="${x + width - 47}" y="${geometry.y + geometry.height - 45}" width="34" height="26" rx="8" fill="#ff6b6b"/><text x="${x + width - 30}" y="${geometry.y + geometry.height - 26}" text-anchor="middle" class="badge">${assignmentCount}</text>`
      : "";

  return `
    <g>
      <rect x="${x}" y="${geometry.y}" width="${width}" height="${geometry.height}" rx="14" fill="${fill}" stroke="${border}" stroke-width="2"/>
      <text x="${x + 14}" y="${geometry.y + 27}" class="key-label">${escapeXml(key)}</text>
      <circle cx="${x + width - (assignmentCount > 1 ? 58 : 16)}" cy="${geometry.y + geometry.height - 15}" r="5" fill="${sourceColor(assignment?.source)}"/>
      ${assigned && hasIcon ? iconMarkup : ""}
      <text x="${x + 14}" y="${geometry.y + 65}" class="title">${escapeXml(title)}</text>
      <text x="${x + 14}" y="${geometry.y + 88}" class="description">${escapeXml(description)}</text>
      ${conflict}
    </g>`;
}

export async function renderKeyboardSvg(shortcutMap: ShortcutMap, iconDirectory: string): Promise<string> {
  await mkdir(iconDirectory, { recursive: true });
  const icons = new Map<string, RenderedIcon>();
  for (const [key, shortcut] of shortcutMap.keys.entries()) {
    icons.set(key, await renderIcon(shortcut.assignments[0]?.icon, iconDirectory));
  }
  const assignedCount = [...shortcutMap.keys.values()].filter((item) => item.assignments.length > 0).length;
  const conflictCount = [...shortcutMap.keys.values()].filter((item) => item.assignments.length > 1).length;
  const staleDays = shortcutMap.warnings
    .find((warning) => warning.includes("Raycast settings snapshot"))
    ?.match(/(\d+) days/)?.[1];
  const sourceSummary = staleDays
    ? `⚠ ${staleDays}-day-old Raycast snapshot · Canvas + JSON`
    : "Raycast snapshot · Canvas context · JSON overrides";

  const rows = KEYBOARD_ROWS.map((row) => {
    const geometry = ROW_GEOMETRY[row.id];
    let x = row.offset ?? 82;
    const keys = row.keys.map((key) => {
      const shortcut = shortcutMap.keys.get(key);
      const markup = renderKey(
        key,
        x,
        geometry,
        shortcut?.assignments[0],
        shortcut?.assignments.length ?? 0,
        icons.get(key) ?? {},
      );
      x += keyWidth(key, geometry) + geometry.gap;
      return markup;
    });
    return keys.join("\n");
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style>
      text { font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif; letter-spacing: 0; }
      .eyebrow { font-size: 20px; font-weight: 700; fill: #f4b400; }
      .heading { font-size: 40px; font-weight: 800; fill: #f5f7fa; }
      .summary { font-size: 18px; font-weight: 500; fill: #9aa3ae; }
      .warning { font-size: 18px; font-weight: 700; fill: #ffad66; }
      .chord { font-size: 27px; font-weight: 700; fill: #f5f7fa; }
      .key-label { font-size: 18px; font-weight: 800; fill: #f4b400; }
      .title { font-size: 16px; font-weight: 700; fill: #f5f7fa; }
      .description { font-size: 12px; font-weight: 500; fill: #929ba6; }
      .emoji { font-family: "Apple Color Emoji", sans-serif; font-size: 31px; }
      .badge { font-size: 13px; font-weight: 800; fill: #111214; }
    </style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="28" fill="#101114"/>
  <rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="22" fill="none" stroke="#2e333a" stroke-width="2"/>
  <text x="82" y="61" class="eyebrow">GLOBAL SHORTCUT MAP</text>
  <text x="82" y="105" class="heading">Hyper Keyboard</text>
  <text x="484" y="101" class="chord">⌃  ⌥  ⇧  ⌘</text>
  <text x="1798" y="66" text-anchor="end" class="summary">${assignedCount} assigned · ${conflictCount} conflicts</text>
  <text x="1798" y="98" text-anchor="end" class="${staleDays ? "warning" : "summary"}">${escapeXml(sourceSummary)}</text>
  ${rows}
</svg>`;
}

export async function generateKeyboardPreview(shortcutMap: ShortcutMap, supportDirectory: string): Promise<string> {
  const previewDirectory = path.join(supportDirectory, "preview");
  const iconDirectory = path.join(supportDirectory, "icons");
  await mkdir(previewDirectory, { recursive: true });
  const svgPath = path.join(previewDirectory, "hyper-keyboard.svg");
  await writeFile(svgPath, await renderKeyboardSvg(shortcutMap, iconDirectory), "utf8");

  try {
    const generatedPath = path.join(previewDirectory, "hyper-keyboard.png");
    await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", generatedPath], {
      timeout: 8_000,
    });
    await readFile(generatedPath);
    return generatedPath;
  } catch {
    return svgPath;
  }
}
