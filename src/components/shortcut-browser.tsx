import { Action, ActionPanel, Color, Icon, Image, Keyboard, List, openExtensionPreferences } from "@raycast/api";
import { useState } from "react";
import { KEYBOARD_ROWS } from "../layout";
import { browseEmptyState } from "../lib/empty-state";
import { browseWarningItems, warningDetailMarkdown } from "../lib/load-status";
import type { Preferences, ShortcutAssignment, ShortcutMap } from "../types";

interface ShortcutBrowserProps {
  shortcutMap: ShortcutMap;
  preferences: Preferences;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function sourceLabel(source: ShortcutAssignment["source"]): string {
  if (source === "raycast") return "Raycast";
  if (source === "canvas") return "Canvas";
  return "Custom";
}

function sourceColor(source: ShortcutAssignment["source"]): Color {
  if (source === "raycast") return Color.Blue;
  if (source === "canvas") return Color.Purple;
  return Color.Green;
}

function imageLike(assignment: ShortcutAssignment | undefined): Image.ImageLike {
  const icon = assignment?.icon;
  if (!icon) return Icon.Keyboard;
  if (icon.kind === "app") return { fileIcon: icon.value };
  if (icon.kind === "emoji") return icon.value;
  return { source: icon.value, fallback: Icon.Keyboard };
}

function shortcutMarkdown(key: string, assignments: ShortcutAssignment[]): string {
  if (assignments.length === 0) return `# Hyper + ${key}\n\nNo shortcut is assigned to this key.`;
  return assignments
    .map((assignment, index) => {
      const title = assignment.title.toLowerCase().replace(/\s+/g, "");
      const description = assignment.description
        ?.split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line.toLowerCase().replace(/\s+/g, "") !== title)
        .join("\n\n");
      return `${index === 0 ? `# Hyper + ${key}` : "---"}\n\n## ${assignment.title}\n\n${description || "No additional notes."}`;
    })
    .join("\n\n");
}

function ShortcutActions({
  keyLabel,
  assignments,
  onRefresh,
}: {
  keyLabel: string;
  assignments: ShortcutAssignment[];
  onRefresh?: () => void;
}) {
  const primary = assignments[0];
  return (
    <ActionPanel>
      <Action.CopyToClipboard title="Copy Shortcut" content={`⌃⌥⇧⌘ ${keyLabel}`} icon={Icon.CopyClipboard} />
      {primary?.icon?.kind === "app" ? (
        <Action.Open title={`Open ${primary.title}`} target={primary.icon.value} icon={imageLike(primary)} />
      ) : null}
      {primary?.sourcePath ? <Action.ShowInFinder path={primary.sourcePath} /> : null}
      <Action
        title="Refresh Keymap"
        icon={Icon.ArrowClockwise}
        onAction={onRefresh}
        shortcut={Keyboard.Shortcut.Common.Refresh}
      />
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
    </ActionPanel>
  );
}

export function ShortcutBrowser({ shortcutMap, preferences, isLoading, onRefresh }: ShortcutBrowserProps) {
  const [searchText, setSearchText] = useState("");
  const empty = browseEmptyState(searchText);
  const warningItems = browseWarningItems(shortcutMap.warnings);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search a key, app, action, or source…"
      onSearchTextChange={setSearchText}
    >
      <List.EmptyView
        icon={searchText.trim() ? Icon.MagnifyingGlass : Icon.Keyboard}
        title={empty.title}
        description={empty.description}
      />
      {warningItems.length > 0 ? (
        <List.Section title="Source warnings" subtitle="Open Extension Preferences or Refresh Keymap">
          {warningItems.map((item) => (
            <List.Item
              key={item.title}
              icon={{ source: Icon.Warning, tintColor: Color.Orange }}
              title={item.title}
              subtitle={item.subtitle}
              keywords={["warning", "preferences", "refresh", item.title]}
              accessories={[{ tag: { value: "Next step", color: Color.Orange } }]}
              detail={<List.Item.Detail markdown={warningDetailMarkdown(item.title)} />}
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Keymap"
                    icon={Icon.ArrowClockwise}
                    onAction={onRefresh}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                  />
                  <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
      {KEYBOARD_ROWS.map((row) => {
        const visibleKeys = row.keys.filter((key) => preferences.showUnassignedKeys || shortcutMap.keys.has(key));
        if (visibleKeys.length === 0) return null;
        return (
          <List.Section key={row.id} title={row.title} subtitle={`${visibleKeys.length} keys`}>
            {visibleKeys.map((key) => {
              const assignments = shortcutMap.keys.get(key)?.assignments ?? [];
              const primary = assignments[0];
              return (
                <List.Item
                  key={key}
                  id={key}
                  icon={imageLike(primary)}
                  title={primary?.title ?? "Unassigned"}
                  subtitle={`Hyper + ${key}`}
                  keywords={[
                    key,
                    ...assignments.flatMap((assignment) => [
                      assignment.title,
                      assignment.description ?? "",
                      assignment.source,
                    ]),
                    ...(assignments.length > 1 ? ["conflict", "冲突"] : []),
                  ]}
                  accessories={[
                    ...(primary
                      ? [{ tag: { value: sourceLabel(primary.source), color: sourceColor(primary.source) } }]
                      : []),
                    ...(assignments.length > 1
                      ? [{ tag: { value: `${assignments.length} conflicts`, color: Color.Red } }]
                      : []),
                  ]}
                  detail={
                    <List.Item.Detail
                      markdown={shortcutMarkdown(key, assignments)}
                      metadata={
                        <List.Item.Detail.Metadata>
                          <List.Item.Detail.Metadata.Label title="Shortcut" text={`⌃⌥⇧⌘ ${key}`} icon={Icon.Keyboard} />
                          {primary ? (
                            <List.Item.Detail.Metadata.Label title="Source" text={sourceLabel(primary.source)} />
                          ) : null}
                          {assignments.length > 1 ? (
                            <List.Item.Detail.Metadata.Label
                              title="Conflict"
                              text={{ value: `${assignments.length} assignments`, color: Color.Red }}
                            />
                          ) : null}
                          {primary?.sourcePath ? (
                            <List.Item.Detail.Metadata.Label title="Read from" text={primary.sourcePath} />
                          ) : null}
                        </List.Item.Detail.Metadata>
                      }
                    />
                  }
                  actions={<ShortcutActions keyLabel={key} assignments={assignments} onRefresh={onRefresh} />}
                />
              );
            })}
          </List.Section>
        );
      })}
    </List>
  );
}
