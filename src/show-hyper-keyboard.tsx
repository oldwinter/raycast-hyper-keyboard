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
import { ShortcutBrowser } from "./components/shortcut-browser";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function ShowHyperKeyboard() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, previewPath, error, isLoading, refresh } = useShortcutMap();
  const { push } = useNavigation();
  const image = previewPath
    ? `![Hyper Keyboard](${encodeURI(previewPath)}?raycast-width=1080&v=${data?.loadedAt.getTime() ?? 0})`
    : undefined;
  const markdown = error
    ? `# Unable to load Hyper Keyboard\n\n${error}`
    : image
      ? image
      : "# Hyper Keyboard\n\nReading your configured shortcuts…";

  return (
    <Detail
      navigationTitle="Hyper Keyboard"
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          {data ? (
            <Action
              title="Browse Hyper Shortcuts"
              icon={Icon.MagnifyingGlass}
              onAction={() =>
                push(<ShortcutBrowser shortcutMap={data} preferences={preferences} onRefresh={refresh} />)
              }
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
