export type BrowseEmptyState = {
  title: string;
  description: string;
};

export function browseEmptyState(searchText: string): BrowseEmptyState {
  if (searchText.trim().length > 0) {
    return {
      title: "No matching shortcuts",
      description: "Try another key, app name, action, or source.",
    };
  }

  return {
    title: "No shortcuts to show",
    description:
      "Turn on Show unassigned keys in Extension Preferences, or add Hyper shortcuts from Raycast, a Canvas file, or custom JSON.",
  };
}
