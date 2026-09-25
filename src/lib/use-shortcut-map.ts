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

export function useShortcutMap(): ShortcutMapState {
  const preferences = getPreferenceValues<Preferences>();
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
    void loadShortcutMap(preferences)
      .then(async (nextData) => {
        const nextPreviews = await generateKeyboardPreview(nextData, environment.supportPath);
        if (!isActive) return;
        setData(nextData);
        setPreviews(nextPreviews);
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
  }, [revision]);

  return { data, previews, error, isLoading, refresh };
}
