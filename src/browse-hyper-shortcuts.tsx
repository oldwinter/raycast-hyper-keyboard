import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  getPreferenceValues,
  openExtensionPreferences,
} from "@raycast/api";
import { ShortcutBrowser } from "./components/shortcut-browser";
import { loadErrorMarkdown } from "./lib/load-status";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function BrowseHyperShortcuts() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, error, isLoading, refresh } = useShortcutMap();
  if (error) {
    return (
      <Detail
        markdown={loadErrorMarkdown("browse", error)}
        metadata={
          <Detail.Metadata>
            <Detail.Metadata.Label title="Error" text={{ value: error, color: Color.Red }} />
            <Detail.Metadata.Label title="Next step" text="Open Extension Preferences or Refresh Keymap" />
          </Detail.Metadata>
        }
        actions={
          <ActionPanel>
            <Action
              title="Refresh Keymap"
              icon={Icon.ArrowClockwise}
              onAction={refresh}
              shortcut={Keyboard.Shortcut.Common.Refresh}
            />
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
    );
  }
  if (!data) return <Detail isLoading={isLoading} markdown="# Hyper Shortcuts\n\nReading your configured shortcuts…" />;
  return <ShortcutBrowser shortcutMap={data} preferences={preferences} isLoading={isLoading} onRefresh={refresh} />;
}
