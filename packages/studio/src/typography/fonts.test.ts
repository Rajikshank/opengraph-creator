import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO_FONT, getReadableFontLabel, getStudioFontOptions, getStudioFontValue, STUDIO_FONT_OPTIONS } from "./fonts";

describe("studio font registry", () => {
  it("offers practical system-safe font stacks for editable text layers", () => {
    const labels = STUDIO_FONT_OPTIONS.map((option) => option.label);

    expect(labels).toEqual(expect.arrayContaining(["Geist / System", "Poppins", "Segoe UI", "Arial", "Georgia", "Bahnschrift", "Consolas", "Impact"]));
    expect(STUDIO_FONT_OPTIONS.every((option) => option.value.length > 0 && option.previewFamily.length > 0)).toBe(true);
  });

  it("preserves generated custom fonts instead of normalizing them to Inter", () => {
    const options = getStudioFontOptions(`"Brand Sans", Arial, sans-serif`);

    expect(options[0]).toMatchObject({
      value: `"Brand Sans", Arial, sans-serif`,
      label: "Custom: Brand Sans",
      category: "custom"
    });
    expect(getStudioFontValue(`"Brand Sans", Arial, sans-serif`)).toBe(`"Brand Sans", Arial, sans-serif`);
  });

  it("falls back only when a text layer has no font value", () => {
    expect(getStudioFontValue("")).toBe(DEFAULT_STUDIO_FONT);
    expect(getReadableFontLabel(`"Times New Roman", Times, serif`)).toBe("Times New Roman");
  });
});
