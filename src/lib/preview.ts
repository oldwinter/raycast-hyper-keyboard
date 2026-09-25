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

interface PreviewViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyboardPreviewPaths {
  overviewPath: string;
  zoomedPaths: [string, string];
}

const WIDTH = 1740;
const HEIGHT = 900;

const ROW_GEOMETRY: Record<string, RowGeometry> = {
  function: { y: 116, height: 90, keyWidth: 127, gap: 10 },
  numbers: { y: 226, height: 114, keyWidth: 138, gap: 10 },
  top: { y: 356, height: 114, keyWidth: 138, gap: 10 },
  home: { y: 486, height: 114, keyWidth: 138, gap: 10 },
  bottom: { y: 616, height: 114, keyWidth: 138, gap: 10 },
  space: { y: 746, height: 112, keyWidth: 680, gap: 10 },
};

const OVERVIEW_VIEWPORT: PreviewViewport = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
const LEFT_ZOOM_VIEWPORT: PreviewViewport = { x: 0, y: 0, width: 1000, height: HEIGHT };
const RIGHT_ZOOM_VIEWPORT: PreviewViewport = { x: WIDTH - 1000, y: 0, width: 1000, height: HEIGHT };

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
  if (!assignment?.description) return "";
  const title = assignment.title.toLowerCase().replace(/\s+/g, "");
  const usefulLines = assignment.description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase().replace(/\s+/g, "") !== title);
  return usefulLines.join(" · ");
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
  if (key === "Enter") return 174;
  if (key === "Space") return 680;
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
  const accent = assignmentCount > 1 ? "#ff6b6b" : sourceColor(assignment?.source);
  const border = assignmentCount > 1 ? "#ff6b6b" : assigned ? "#424a55" : "#272c33";
  const fill = assigned ? "#191d23" : "#12151a";
  const faceClass = assigned ? "key-face" : "key-face key-face-empty";
  const title = assignment ? truncateToPixels(assignment.title, width - 18, 14) : "";
  const description = truncateToPixels(displayDescription(assignment), width - 18, 10);
  const iconSize = geometry.height < 100 ? 43 : 54;
  const iconX = x + (width - iconSize) / 2;
  const iconY = geometry.y + (geometry.height < 100 ? 20 : 18);
  const iconMarkup = icon.dataUri
    ? `<rect class="icon-chip" x="${iconX - 3}" y="${iconY - 3}" width="${iconSize + 6}" height="${iconSize + 6}" rx="14" fill="#252b34"/>
       <image href="${icon.dataUri}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet"/>`
    : icon.emoji
      ? `<rect class="icon-chip" x="${iconX - 3}" y="${iconY - 3}" width="${iconSize + 6}" height="${iconSize + 6}" rx="14" fill="#252b34"/>
         <text x="${x + width / 2}" y="${iconY + iconSize - 8}" text-anchor="middle" class="emoji">${escapeXml(icon.emoji)}</text>`
      : "";
  const conflict =
    assignmentCount > 1
      ? `<rect x="${x + width - 34}" y="${geometry.y + 9}" width="24" height="20" rx="7" fill="#ff6b6b"/><text x="${x + width - 22}" y="${geometry.y + 24}" text-anchor="middle" class="badge">${assignmentCount}</text>`
      : "";

  if (!assigned) {
    return `
    <g>
      <rect class="key-shadow" x="${x}" y="${geometry.y + 3}" width="${width}" height="${geometry.height}" rx="13" fill="#060709" opacity="0.75"/>
      <rect class="${faceClass}" x="${x}" y="${geometry.y}" width="${width}" height="${geometry.height}" rx="13" fill="${fill}" stroke="${border}" stroke-width="1.5"/>
      <text x="${x + width / 2}" y="${geometry.y + geometry.height / 2 + 7}" text-anchor="middle" class="unassigned-key">${escapeXml(key)}</text>
    </g>`;
  }

  const contentMarkup = hasIcon
    ? `${iconMarkup}
      <text x="${x + width / 2}" y="${geometry.y + geometry.height - 24}" text-anchor="middle" class="title">${escapeXml(title)}</text>
      ${description ? `<text x="${x + width / 2}" y="${geometry.y + geometry.height - 9}" text-anchor="middle" class="description">${escapeXml(description)}</text>` : ""}`
    : `<text x="${x + width / 2}" y="${geometry.y + geometry.height / 2 + 2}" text-anchor="middle" class="title title-large">${escapeXml(title)}</text>
      ${description ? `<text x="${x + width / 2}" y="${geometry.y + geometry.height / 2 + 23}" text-anchor="middle" class="description">${escapeXml(description)}</text>` : ""}`;

  return `
    <g>
      <rect class="key-shadow" x="${x}" y="${geometry.y + 4}" width="${width}" height="${geometry.height}" rx="13" fill="#050607" opacity="0.9"/>
      <rect class="${faceClass}" x="${x}" y="${geometry.y}" width="${width}" height="${geometry.height}" rx="13" fill="${fill}" stroke="${border}" stroke-width="1.5"/>
      <rect class="key-accent" x="${x + 10}" y="${geometry.y + geometry.height - 4}" width="${width - 20}" height="3" rx="1.5" fill="${accent}" opacity="0.9"/>
      <text x="${x + 11}" y="${geometry.y + 23}" class="key-label">${escapeXml(key)}</text>
      ${contentMarkup}
      ${conflict}
    </g>`;
}

export async function renderKeyboardSvg(
  shortcutMap: ShortcutMap,
  iconDirectory: string,
  viewport: PreviewViewport = OVERVIEW_VIEWPORT,
): Promise<string> {
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
  const sourceSummary = staleDays ? `Raycast snapshot ${staleDays}d old · Canvas · JSON` : "Raycast · Canvas · JSON";

  const rows = KEYBOARD_ROWS.map((row) => {
    const geometry = ROW_GEOMETRY[row.id];
    let x = row.offset ?? 52;
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}">
  <defs>
    <style>
      :root {
        color-scheme: light dark;
        --canvas: #f5f2ea;
        --frame: #ffffff;
        --frame-border: #d8d4c9;
        --text: #1d2129;
        --muted: #5d6672;
        --warning-text: #a8550a;
        --chord-text: #4b5563;
        --key-label-text: #2e3540;
        --key-empty-text: #9aa3ad;
        --description-text: #6a7480;
        --key-fill: #ffffff;
        --key-fill-empty: #e9e6dd;
        --key-border: #c9cdd4;
        --key-border-empty: #d8d4c9;
        --key-shadow: #d6d2c7;
        --icon-chip: #eef0f3;
      }
      text { font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif; letter-spacing: 0; }
      .heading { font-size: 38px; font-weight: 750; fill: #f7f8fa; }
      .summary { font-size: 17px; font-weight: 600; fill: #a9b1bc; }
      .warning { font-size: 16px; font-weight: 650; fill: #ffbd70; }
      .chord { font-size: 24px; font-weight: 650; fill: #cad1da; }
      .key-label { font-size: 16px; font-weight: 750; fill: #dce2ea; }
      .unassigned-key { font-size: 18px; font-weight: 700; fill: #626b76; }
      .title { font-size: 14px; font-weight: 700; fill: #f5f7fa; }
      .title-large { font-size: 16px; }
      .description { font-size: 10px; font-weight: 550; fill: #9da6b2; }
      .emoji { font-family: "Apple Color Emoji", sans-serif; font-size: 40px; }
      .badge { font-size: 12px; font-weight: 800; fill: #111214; }
      @media (prefers-color-scheme: light) {
        .canvas-bg { fill: var(--canvas); }
        .frame { fill: var(--frame); stroke: var(--frame-border); }
        .key-face { fill: var(--key-fill); stroke: var(--key-border); }
        .key-face-empty { fill: var(--key-fill-empty); stroke: var(--key-border-empty); }
        .key-shadow { fill: var(--key-shadow); }
        .icon-chip { fill: var(--icon-chip); }
        .heading { fill: var(--text); }
        .title { fill: var(--text); }
        .summary { fill: var(--muted); }
        .description { fill: var(--description-text); }
        .warning { fill: var(--warning-text); }
        .chord { fill: var(--chord-text); }
        .key-label { fill: var(--key-label-text); }
        .unassigned-key { fill: var(--key-empty-text); }
      }
    </style>
  </defs>
  <rect class="canvas-bg" width="${WIDTH}" height="${HEIGHT}" fill="#090b0e"/>
  <rect class="frame" x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" rx="24" fill="#0f1216" stroke="#272c34" stroke-width="1.5"/>
  <text x="52" y="72" class="heading">Hyper Keyboard</text>
  <text x="354" y="69" class="chord">⌃  ⌥  ⇧  ⌘</text>
  <text x="${WIDTH - 52}" y="53" text-anchor="end" class="summary">${assignedCount} mapped · ${conflictCount} conflicts</text>
  <text x="${WIDTH - 52}" y="80" text-anchor="end" class="${staleDays ? "warning" : "summary"}">${escapeXml(sourceSummary)}</text>
  ${rows}
</svg>`;
}

async function writePreview(
  shortcutMap: ShortcutMap,
  iconDirectory: string,
  previewDirectory: string,
  name: string,
  viewport: PreviewViewport,
): Promise<string> {
  const svgPath = path.join(previewDirectory, `${name}.svg`);
  await writeFile(svgPath, await renderKeyboardSvg(shortcutMap, iconDirectory, viewport), "utf8");

  try {
    const generatedPath = path.join(previewDirectory, `${name}.png`);
    await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", generatedPath], {
      timeout: 8_000,
    });
    await readFile(generatedPath);
    return generatedPath;
  } catch {
    return svgPath;
  }
}

export async function generateKeyboardPreview(
  shortcutMap: ShortcutMap,
  supportDirectory: string,
): Promise<KeyboardPreviewPaths> {
  const previewDirectory = path.join(supportDirectory, "preview");
  const iconDirectory = path.join(supportDirectory, "icons");
  await mkdir(previewDirectory, { recursive: true });
  const overviewPath = await writePreview(
    shortcutMap,
    iconDirectory,
    previewDirectory,
    "hyper-keyboard",
    OVERVIEW_VIEWPORT,
  );
  const leftPath = await writePreview(
    shortcutMap,
    iconDirectory,
    previewDirectory,
    "hyper-keyboard-left",
    LEFT_ZOOM_VIEWPORT,
  );
  const rightPath = await writePreview(
    shortcutMap,
    iconDirectory,
    previewDirectory,
    "hyper-keyboard-right",
    RIGHT_ZOOM_VIEWPORT,
  );
  return { overviewPath, zoomedPaths: [leftPath, rightPath] };
}
