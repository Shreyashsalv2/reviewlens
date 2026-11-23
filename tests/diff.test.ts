import { describe, expect, it } from "vitest";
import { addedLines, parsePatch } from "@/lib/diff";

const PATCH = [
  "@@ -1,4 +1,5 @@ export function a() {",
  " const x = 1;",
  "-const y = 2;",
  "+const y = 3;",
  "+const z = 4;",
  " return x;",
  "@@ -20,2 +21,3 @@",
  " // end",
  "+added at 22",
  "\\ No newline at end of file",
].join("\n");

describe("parsePatch", () => {
  it("returns no hunks for a missing patch", () => {
    expect(parsePatch(undefined)).toEqual([]);
    expect(parsePatch("")).toEqual([]);
  });

  it("splits hunks and numbers new-file lines, skipping removed lines", () => {
    const hunks = parsePatch(PATCH);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].lines.map((l) => [l.number, l.text, l.added])).toEqual([
      [1, "const x = 1;", false],
      [2, "const y = 3;", true],
      [3, "const z = 4;", true],
      [4, "return x;", false],
    ]);
    expect(hunks[1].lines.map((l) => l.number)).toEqual([21, 22]);
  });

  it("ignores the 'no newline' marker", () => {
    const last = parsePatch(PATCH)[1].lines.at(-1);
    expect(last?.text).toBe("added at 22");
  });
});

describe("addedLines", () => {
  it("returns only added lines with their new line numbers", () => {
    expect(addedLines(PATCH).map((l) => `${l.number}:${l.text}`)).toEqual(["2:const y = 3;", "3:const z = 4;", "22:added at 22"]);
  });
});
