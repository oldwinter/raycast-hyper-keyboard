import { environment, getPreferenceValues } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { loadShortcutMap } from "../data/load";
import type { Preferences, ShortcutMap } from "../types";
import { generateKeyboardPreview } from "./preview";

interface ShortcutMapState {
  data?: ShortcutMap;
  previewPath?: string;
  error?: string;
  isLoading: boolean;
  refresh: () => void;
}

export function useShortcutMap(): ShortcutMapState {
  const preferences = getPreferenceValues<Preferences>();
  const [data, setData] = useState<ShortcutMap>();
  const [previewPath, setPreviewPath] = useState<string>();
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
        const nextPreviewPath = await generateKeyboardPreview(nextData, environment.supportPath);
        if (!isActive) return;
        setData(nextData);
        setPreviewPath(nextPreviewPath);
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

  return { data, previewPath, error, isLoading, refresh };
}
