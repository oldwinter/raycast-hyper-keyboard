export const LOAD_NEXT_STEP =
  "Open **Extension Preferences** to set Canvas File, a Raycast snapshot directory, or Custom JSON. Then use **Refresh Keymap**.";

export function missingCanvasFileWarning(canvasPath: string): string {
  return `Canvas file not found: ${canvasPath}`;
}

export function loadErrorMarkdown(command: "show" | "browse", error: string): string {
  const title = command === "show" ? "Unable to load Hyper Keyboard" : "Unable to load shortcuts";
  return `# ${title}\n\n${error}\n\n${LOAD_NEXT_STEP}`;
}

export function showKeyboardMarkdown(options: { error?: string; image?: string; warnings: string[] }): string {
  if (options.error) return loadErrorMarkdown("show", options.error);
  const body = options.image ?? "# Hyper Keyboard\n\nReading your configured shortcuts…";
  if (options.warnings.length === 0) return body;
  const items = options.warnings.map((warning) => `- ${warning}`).join("\n");
  return `${body}\n\n## Source warnings\n\n${items}\n\n${LOAD_NEXT_STEP}`;
}

export function warningDetailMarkdown(warning: string): string {
  return `# Source warning\n\n${warning}\n\n${LOAD_NEXT_STEP}`;
}

export function browseWarningItems(warnings: string[]): Array<{ title: string; subtitle: string }> {
  return warnings.map((warning) => ({
    title: warning,
    subtitle: "Open Extension Preferences or Refresh Keymap",
  }));
}
