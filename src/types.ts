export type ShortcutSource = "raycast" | "canvas" | "custom";

export type IconReference =
  | { kind: "app"; value: string }
  | { kind: "file"; value: string }
  | { kind: "url"; value: string }
  | { kind: "emoji"; value: string };

export interface ShortcutAssignment {
  key: string;
  title: string;
  description?: string;
  source: ShortcutSource;
  sourcePath?: string;
  commandId?: string;
  extensionId?: string;
  icon?: IconReference;
  enabled?: boolean;
}

export interface ShortcutKey {
  key: string;
  assignments: ShortcutAssignment[];
}

export interface ShortcutMap {
  keys: Map<string, ShortcutKey>;
  sourceFiles: string[];
  warnings: string[];
  loadedAt: Date;
}

export interface CustomShortcutConfig {
  version: 1;
  shortcuts: Array<{
    key: string;
    title: string;
    description?: string;
    icon?: string;
    appPath?: string;
    replace?: boolean;
  }>;
}

export interface Preferences {
  readRaycastSnapshots: boolean;
  raycastSnapshotsDirectory?: string;
  readCanvas: boolean;
  canvasPath?: string;
  customConfigPath?: string;
  showUnassignedKeys: boolean;
}
