/** Field metadata for the settings form. Filled in fully by Task 6. */
export type SettingsTab = "ai" | "search" | "scoring" | "terminal";
export type SettingsFieldComponent =
  | "text"
  | "number"
  | "select"
  | "password"
  | "slider";
export type SettingsFieldEffect = "live" | "restart";

export interface SettingsFieldOption {
  value: string;
  label: string;
}

export interface SettingsField {
  tab: SettingsTab;
  section: string;
  envVar: string;
  label: string;
  component: SettingsFieldComponent;
  effect?: SettingsFieldEffect;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  mono?: boolean;
  datalist?: string[];
  options?: SettingsFieldOption[];
}

export const SETTINGS_FIELDS: SettingsField[] = [];  // filled in Task 6
