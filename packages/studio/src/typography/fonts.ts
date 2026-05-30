export interface StudioFontOption {
  value: string;
  label: string;
  previewFamily: string;
  category: "system" | "serif" | "mono" | "display" | "custom";
}

export const DEFAULT_STUDIO_FONT = `"Geist Variable", Inter, Arial, sans-serif`;

export const STUDIO_FONT_OPTIONS: StudioFontOption[] = [
  {
    value: DEFAULT_STUDIO_FONT,
    label: "Geist / System",
    previewFamily: `"Geist Variable", Inter, "Segoe UI", Arial, sans-serif`,
    category: "system"
  },
  {
    value: `Poppins, "Geist Variable", Arial, sans-serif`,
    label: "Poppins",
    previewFamily: `Poppins, "Geist Variable", Arial, sans-serif`,
    category: "display"
  },
  {
    value: `"Segoe UI", Arial, sans-serif`,
    label: "Segoe UI",
    previewFamily: `"Segoe UI", Arial, sans-serif`,
    category: "system"
  },
  {
    value: `Arial, "Helvetica Neue", sans-serif`,
    label: "Arial",
    previewFamily: `Arial, "Helvetica Neue", sans-serif`,
    category: "system"
  },
  {
    value: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
    label: "Helvetica",
    previewFamily: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
    category: "system"
  },
  {
    value: `Georgia, "Times New Roman", serif`,
    label: "Georgia",
    previewFamily: `Georgia, "Times New Roman", serif`,
    category: "serif"
  },
  {
    value: `"Times New Roman", Times, serif`,
    label: "Times New Roman",
    previewFamily: `"Times New Roman", Times, serif`,
    category: "serif"
  },
  {
    value: `Verdana, Geneva, sans-serif`,
    label: "Verdana",
    previewFamily: `Verdana, Geneva, sans-serif`,
    category: "system"
  },
  {
    value: `"Trebuchet MS", Arial, sans-serif`,
    label: "Trebuchet MS",
    previewFamily: `"Trebuchet MS", Arial, sans-serif`,
    category: "system"
  },
  {
    value: `Tahoma, Geneva, sans-serif`,
    label: "Tahoma",
    previewFamily: `Tahoma, Geneva, sans-serif`,
    category: "system"
  },
  {
    value: `Calibri, "Segoe UI", Arial, sans-serif`,
    label: "Calibri",
    previewFamily: `Calibri, "Segoe UI", Arial, sans-serif`,
    category: "system"
  },
  {
    value: `Cambria, Georgia, serif`,
    label: "Cambria",
    previewFamily: `Cambria, Georgia, serif`,
    category: "serif"
  },
  {
    value: `Bahnschrift, "Segoe UI", Arial, sans-serif`,
    label: "Bahnschrift",
    previewFamily: `Bahnschrift, "Segoe UI", Arial, sans-serif`,
    category: "display"
  },
  {
    value: `Consolas, "Courier New", monospace`,
    label: "Consolas",
    previewFamily: `Consolas, "Courier New", monospace`,
    category: "mono"
  },
  {
    value: `"Courier New", Courier, monospace`,
    label: "Courier New",
    previewFamily: `"Courier New", Courier, monospace`,
    category: "mono"
  },
  {
    value: `Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif`,
    label: "Impact",
    previewFamily: `Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif`,
    category: "display"
  }
];

export function getStudioFontOptions(currentFontFamily?: string): StudioFontOption[] {
  const fontFamily = currentFontFamily?.trim();
  if (!fontFamily || STUDIO_FONT_OPTIONS.some((option) => option.value === fontFamily)) {
    return STUDIO_FONT_OPTIONS;
  }
  return [
    {
      value: fontFamily,
      label: `Custom: ${getReadableFontLabel(fontFamily)}`,
      previewFamily: fontFamily,
      category: "custom"
    },
    ...STUDIO_FONT_OPTIONS
  ];
}

export function getStudioFontValue(fontFamily?: string): string {
  const value = fontFamily?.trim();
  return value || DEFAULT_STUDIO_FONT;
}

export function getReadableFontLabel(fontFamily: string): string {
  return fontFamily
    .split(",")[0]
    .replaceAll('"', "")
    .replaceAll("'", "")
    .trim() || "Font";
}

export async function preloadFontFamily(fontFamily: string, sample = "OpenGraph Creator OG"): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const family = getReadableFontLabel(fontFamily);
  const fonts = document.fonts;
  await Promise.all([
    fonts.load(`400 16px "${family}"`, sample),
    fonts.load(`700 16px "${family}"`, sample)
  ]);
}
