import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  getPreferenceValues,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { ShortcutBrowser } from "./components/shortcut-browser";
import { showKeyboardMarkdown } from "./lib/load-status";
import type { Preferences } from "./types";
import { useShortcutMap } from "./lib/use-shortcut-map";

export default function ShowHyperKeyboard() {
  const preferences = getPreferenceValues<Preferences>();
  const { data, previewPath, error, isLoading, refresh } = useShortcutMap();
  const { push } = useNavigation();
  const warnings = data?.warnings ?? [];
  const image = previewPath
    ? `![Hyper Keyboard](${encodeURI(previewPath)}?raycast-width=1080&v=${data?.loadedAt.getTime() ?? 0})`
    : undefined;
  const markdown = showKeyboardMarkdown({ error, image, warnings });

  return (
    <Detail
      navigationTitle="Hyper Keyboard"
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        error || warnings.length > 0 ? (
          <Detail.Metadata>
            {error ? <Detail.Metadata.Label title="Error" text={{ value: error, color: Color.Red }} /> : null}
            {warnings.map((warning, index) => (
              <Detail.Metadata.Label
                key={`${index}:${warning}`}
                title={`Warning ${index + 1}`}
                text={{ value: warning, color: Color.Orange }}
              />
            ))}
            <Detail.Metadata.Label title="Next step" text="Open Extension Preferences or Refresh Keymap" />
          </Detail.Metadata>
        ) : undefined
      }
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
