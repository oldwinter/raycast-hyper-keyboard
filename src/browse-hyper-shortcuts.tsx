import { Detail, getPreferenceValues } from "@raycast/api";
import { ShortcutBrowser } from "./components/shortcut-browser";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function BrowseHyperShortcuts() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, error, isLoading, refresh } = useShortcutMap();
  if (error) return <Detail markdown={`# Unable to load shortcuts\n\n${error}`} />;
  if (!data) return <Detail isLoading={isLoading} markdown="# Hyper Shortcuts\n\nReading your configured shortcuts…" />;
  return <ShortcutBrowser shortcutMap={data} preferences={preferences} isLoading={isLoading} onRefresh={refresh} />;
}
