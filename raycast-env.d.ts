/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Raycast Settings - Read the newest local Raycast settings snapshot without modifying it */
  "readRaycastSnapshots": boolean,
  /** Raycast Snapshot Directory - Optional override for the Raycast cloud-sync settings-snapshots directory */
  "raycastSnapshotsDirectory"?: string,
  /** Obsidian Canvas - Use the Canvas to add labels, notes, icons, and non-Raycast shortcuts */
  "readCanvas": boolean,
  /** Canvas File - Optional Canvas override; the oldwinter-notes Hyper keyboard Canvas is detected automatically */
  "canvasPath"?: string,
  /** Custom JSON - Optional versioned JSON file for overrides and shortcuts from other tools */
  "customConfigPath"?: string,
  /** Keyboard Layout - Keep empty keys visible so the visual map remains a recognizable keyboard */
  "showUnassignedKeys": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `show-hyper-keyboard` command */
  export type ShowHyperKeyboard = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-hyper-shortcuts` command */
  export type BrowseHyperShortcuts = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `show-hyper-keyboard` command */
  export type ShowHyperKeyboard = {}
  /** Arguments passed to the `browse-hyper-shortcuts` command */
  export type BrowseHyperShortcuts = {}
}
