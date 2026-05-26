export const STORAGE_KEY_SETTINGS = "settings";

export type Settings = {
  showRaw: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  showRaw: false,
};

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}
