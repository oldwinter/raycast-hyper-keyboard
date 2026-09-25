import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Keyboard,
  getPreferenceValues,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { ShortcutBrowser } from "./components/shortcut-browser";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function ShowHyperKeyboard() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, previews, error, isLoading, refresh } = useShortcutMap();
  const { push } = useNavigation();
  const [isZoomed, setIsZoomed] = useState(false);
  const version = data?.loadedAt.getTime() ?? 0;
  const image = previews
    ? isZoomed
      ? previews.zoomedPaths
          .map(
            (previewPath, index) =>
              `![Hyper Keyboard ${index === 0 ? "Left" : "Right"}](${encodeURI(previewPath)}?raycast-width=1080&v=${version})`,
          )
          .join("\n\n")
      : `![Hyper Keyboard](${encodeURI(previews.overviewPath)}?raycast-width=1080&v=${version})`
    : undefined;
  const warnings = data?.warnings ?? [];
  const warningMarkdown =
    warnings.length > 0
      ? `\n\n---\n\n### ⚠ Needs attention\n\n${warnings.map((warning) => `- ${warning}`).join("\n")}`
      : "";
  const markdown = error
    ? `# Unable to load Hyper Keyboard\n\n${error}\n\nCheck your source paths in **Extension Preferences**, then run **Refresh Keymap** below.`
    : image
      ? `${image}${warningMarkdown}`
      : "# Hyper Keyboard\n\nReading your configured shortcuts…";

  return (
    <Detail
      navigationTitle={isZoomed ? "Hyper Keyboard · Zoomed" : "Hyper Keyboard"}
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        warnings.length > 0 ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Warnings" text={`${warnings.length}`} icon={Icon.ExclamationMark} />
            {warnings.map((warning, index) => (
              <Detail.Metadata.Label key={index} title={index === 0 ? "Sources" : ""} text={warning} />
            ))}
            <Detail.Metadata.Separator />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          {previews ? (
            <Action
              title={isZoomed ? "Zoom out" : "Zoom in"}
              icon={isZoomed ? Icon.Minus : Icon.Plus}
              onAction={() => setIsZoomed((current) => !current)}
              shortcut={{ modifiers: ["cmd"], key: isZoomed ? "-" : "+" }}
            />
          ) : null}
          {data ? (
            <Action
              title="Browse Hyper Shortcuts"
              icon={Icon.MagnifyingGlass}
              onAction={() =>
                push(<ShortcutBrowser shortcutMap={data} preferences={preferences} onRefresh={refresh} />)
              }
            />
          ) : null}
          {previews ? (
            <Action.Open
              title="Open Full-Size Keyboard"
              target={previews.overviewPath}
              icon={Icon.ArrowsExpand}
              shortcut={Keyboard.Shortcut.Common.ToggleQuickLook}
            />
          ) : null}
          <Action
            title="Refresh Keymap"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
          {data?.sourceFiles[0] ? <Action.ShowInFinder path={data.sourceFiles[0]} /> : null}
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}
