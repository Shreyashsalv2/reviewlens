import { describe, expect, it } from "vitest";
import { buildReport, countsLine, lineUrl, plural, toMarkdown } from "@/lib/report";
import { SAMPLES } from "@/lib/samples";
import { addedFile, prInfo } from "./helpers";

describe("buildReport", () => {
  it("is clean when nothing is flagged", () => {
    const r = buildReport(prInfo(), [addedFile("src/a.ts", ["export const a = 1;"]), addedFile("src/a.test.ts", ["it('a')"])]);
    expect(r.verdict).toBe("looks-clean");
    expect(r.findings).toEqual([]);
    expect(r.checklist.every((c) => c.passed)).toBe(true);
    expect(r.checklist.map((c) => c.rule)).toEqual(["secret", "missing-tests", "long-function", "debug-print", "todo", "large-pr"]);
  });

  it("needs changes when a secret is found, and sorts critical first", () => {
    const r = buildReport(prInfo(), [addedFile("src/a.ts", ["// TODO: x", 'console.log("x")', 'const password = "s3cretpass99";'])]);
    expect(r.verdict).toBe("needs-changes");
    expect(r.findings.map((f) => f.severity)).toEqual(["critical", "warning", "warning", "info"]);
    expect(r.counts).toEqual({ critical: 1, warning: 2, info: 1 });
    const todo = r.checklist.find((c) => c.rule === "todo");
    expect(todo).toMatchObject({ passed: true, count: 1 });
  });

  it("asks for a careful review when there are only warnings", () => {
    const r = buildReport(prInfo(), [addedFile("src/a.ts", ['console.log("x")'])]);
    expect(r.verdict).toBe("review-carefully");
  });
});

describe("wording", () => {
  it("pluralises counts", () => {
    expect(plural(1, "file")).toBe("1 file");
    expect(plural(3, "file")).toBe("3 files");
    expect(countsLine({ critical: 2, warning: 1, info: 0 })).toBe("2 critical, 1 warning, 0 notes");
  });
});

describe("lineUrl", () => {
  it("links to the line in the PR's head commit", () => {
    expect(lineUrl(prInfo(), "src/my file.ts", 12)).toBe("https://github.com/acme/shop/blob/abc123/src/my%20file.ts#L12");
  });

  it("falls back to the PR files tab when the fork is gone", () => {
    expect(lineUrl(prInfo({ headRepo: null }), "src/a.ts", 1)).toBe("https://github.com/acme/shop/pull/7/files");
  });

  it("returns null for samples, which have no URL", () => {
    expect(lineUrl(prInfo({ url: "" }), "a.ts", 1)).toBeNull();
  });
});

describe("toMarkdown", () => {
  it("renders a checklist and findings ready to paste", () => {
    const md = toMarkdown(buildReport(prInfo({ title: "Add cart" }), [addedFile("src/a.ts", ['console.log("x")'])]));
    expect(md).toContain("## ReviewLens: Review carefully");
    expect(md).toContain("**Add cart** (#7)");
    expect(md).toContain("- [ ] Code changes come with new or updated tests (1)");
    expect(md).toContain("- [x] No API keys, tokens, passwords or private keys in the diff");
    expect(md).toContain("🟡 `src/a.ts:1` Debug output left in the code.");
  });
});

describe("bundled samples", () => {
  it("each sample produces the verdict it is meant to demo", () => {
    const verdicts = Object.fromEntries(SAMPLES.map((s) => [s.id, buildReport(s.pr, s.files).verdict]));
    expect(verdicts).toEqual({ webhook: "needs-changes", importer: "review-carefully", dates: "looks-clean" });
  });

  it("the webhook sample trips every code check", () => {
    const s = SAMPLES.find((x) => x.id === "webhook")!;
    const rules = new Set(buildReport(s.pr, s.files).findings.map((f) => f.rule));
    expect([...rules].sort()).toEqual(["debug-print", "long-function", "missing-tests", "secret", "todo"]);
  });
});
