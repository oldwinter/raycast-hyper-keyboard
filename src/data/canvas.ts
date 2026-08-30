import path from "node:path";
import { normalizeKey } from "../layout";
import type { IconReference, ShortcutAssignment } from "../types";
import { readJsonFile, resolveRelativeToAncestor } from "../lib/files";

interface CanvasNode {
  id: string;
  type: "text" | "file" | "link" | "group";
  text?: string;
  file?: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasDocument {
  nodes: CanvasNode[];
}

interface KeyNode {
  node: CanvasNode;
  key: string;
  body: string;
}

function parseKeyNode(node: CanvasNode): KeyNode | undefined {
  if (node.type !== "text" || !node.text) return undefined;
  const match = node.text.match(/^#{1,2}\s+([^\n]+)\n?([\s\S]*)$/);
  if (!match) return undefined;
  const key = normalizeKey(match[1]);
  if (!key) return undefined;
  return { node, key, body: match[2].trim() };
}

function cleanWikiLinks(value: string): string {
  return value
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function titleFromBody(body: string): string {
  const aliasedLink = body.match(/\[\[[^\]|]+\|([^\]]+)\]\]/)?.[1];
  const directLink = body.match(/\[\[([^\]]+)\]\]/)?.[1];
  const firstLine = cleanWikiLinks(body).split("\n").find(Boolean);
  return (aliasedLink ?? directLink ?? firstLine ?? "Unlabeled shortcut").trim();
}

function isImageNode(node: CanvasNode): boolean {
  const value = node.url ?? node.file ?? "";
  return /\.(?:png|jpe?g|webp|gif|svg)(?:\?.*)?$/i.test(value);
}

function center(node: CanvasNode): [number, number] {
  return [node.x + node.width / 2, node.y + node.height / 2];
}

function nearestIcon(keyNode: CanvasNode, candidates: CanvasNode[]): CanvasNode | undefined {
  const [keyX, keyY] = center(keyNode);
  return candidates
    .map((candidate) => {
      const [candidateX, candidateY] = center(candidate);
      return { candidate, distance: Math.hypot(candidateX - keyX, candidateY - keyY) };
    })
    .filter(({ distance }) => distance <= Math.max(keyNode.width, keyNode.height) * 0.85)
    .sort((left, right) => left.distance - right.distance)[0]?.candidate;
}

function iconFromNode(node: CanvasNode | undefined, canvasPath: string): IconReference | undefined {
  if (!node) return undefined;
  if (node.url) return { kind: "url", value: node.url };
  if (!node.file) return undefined;
  const absolutePath = path.isAbsolute(node.file)
    ? node.file
    : (resolveRelativeToAncestor(canvasPath, node.file) ?? path.resolve(path.dirname(canvasPath), node.file));
  return { kind: "file", value: absolutePath };
}

export async function parseCanvasShortcuts(canvasPath: string): Promise<ShortcutAssignment[]> {
  const document = await readJsonFile<CanvasDocument>(canvasPath);
  if (!Array.isArray(document.nodes)) throw new Error("Canvas does not contain a nodes array");

  const keyNodes = document.nodes.map(parseKeyNode).filter((entry): entry is KeyNode => Boolean(entry));
  const imageNodes = document.nodes.filter(isImageNode);

  return keyNodes
    .filter(({ body }) => body.length > 0)
    .map(({ key, body, node }) => ({
      key,
      title: titleFromBody(body),
      description: cleanWikiLinks(body),
      source: "canvas" as const,
      sourcePath: canvasPath,
      icon: iconFromNode(nearestIcon(node, imageNodes), canvasPath),
      enabled: true,
    }));
}
