import { environment, getPreferenceValues } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { loadShortcutMap } from "../data/load";
import type { Preferences, ShortcutMap } from "../types";
import { generateKeyboardPreview, type KeyboardPreviewPaths } from "./preview";

interface ShortcutMapState {
  data?: ShortcutMap;
  previews?: KeyboardPreviewPaths;
  error?: string;
  isLoading: boolean;
  refresh: () => void;
}

export interface ShortcutMapLoadResult {
  data: ShortcutMap;
  previews?: KeyboardPreviewPaths;
}

export async function loadShortcutMapState(
  preferences: Preferences,
  options: { previews: boolean; supportPath: string },
): Promise<ShortcutMapLoadResult> {
  const data = await loadShortcutMap(preferences);
  if (!options.previews) return { data };
  try {
    return { data, previews: await generateKeyboardPreview(data, options.supportPath) };
  } catch (previewError) {
    const message = previewError instanceof Error ? previewError.message : String(previewError);
    return {
      data: {
        ...data,
        warnings: [
          ...data.warnings,
          `Keyboard preview could not be generated: ${message}. Shortcut data is unaffected; run Refresh Keymap to retry.`,
        ],
      },
    };
  }
}

export function useShortcutMap(options: { previews?: boolean } = {}): ShortcutMapState {
  const withPreviews = options.previews ?? false;
  const preferences = getPreferenceValues<Preferences>();
  const preferencesSignature = JSON.stringify(preferences);
  const [data, setData] = useState<ShortcutMap>();
  const [previews, setPreviews] = useState<KeyboardPreviewPaths>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(undefined);
    void loadShortcutMapState(JSON.parse(preferencesSignature) as Preferences, {
      previews: withPreviews,
      supportPath: environment.supportPath,
    })
      .then((result) => {
        if (!isActive) return;
        setData(result.data);
        if (result.previews) setPreviews(result.previews);
      })
      .catch((loadError: unknown) => {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [revision, preferencesSignature, withPreviews]);

  return { data, previews, error, isLoading, refresh };
}
