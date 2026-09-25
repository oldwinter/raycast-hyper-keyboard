import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Keyboard,
  getPreferenceValues,
  openExtensionPreferences,
} from "@raycast/api";
import { ShortcutBrowser } from "./components/shortcut-browser";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function BrowseHyperShortcuts() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, error, isLoading, refresh } = useShortcutMap();
  if (error)
    return (
      <Detail
        markdown={`# Unable to load shortcuts\n\n${error}\n\nCheck your source paths in **Extension Preferences**, then run **Refresh Keymap** below.`}
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
  if (!data) return <Detail isLoading={isLoading} markdown="# Hyper Shortcuts\n\nReading your configured shortcuts…" />;
  return <ShortcutBrowser shortcutMap={data} preferences={preferences} isLoading={isLoading} onRefresh={refresh} />;
}
