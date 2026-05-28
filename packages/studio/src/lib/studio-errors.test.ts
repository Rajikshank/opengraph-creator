import { describe, expect, it } from "vitest";
import { normalizeStudioError } from "./studio-errors";

describe("studio error normalization", () => {
  it("turns raw API/network errors into actionable Studio messages", () => {
    const info = normalizeStudioError(new Error("Could not export project: 500"), {
      kind: "export",
      title: "Export failed",
      recovery: "Your editable document is still safe. Retry export after checking the local Studio server."
    });

    expect(info).toMatchObject({
      kind: "export",
      title: "Export failed",
      retryable: true
    });
    expect(info.message).not.toContain("500");
    expect(info.recovery).toContain("editable document");
    expect(info.technical).toContain("Could not export project: 500");
  });

  it("keeps validation and session failures explicit without leaking raw stack text", () => {
    const info = normalizeStudioError("Session opened, but no editable .ogdoc document exists yet.", {
      kind: "session-missing",
      title: "Session document missing",
      recovery: "Ask the coding agent to regenerate the editable .ogdoc document, then reopen this session."
    });

    expect(info.kind).toBe("session-missing");
    expect(info.retryable).toBe(false);
    expect(info.message).toContain(".ogdoc");
    expect(info.recovery).toContain("regenerate");
  });
});
