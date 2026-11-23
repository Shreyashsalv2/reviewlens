import type { PrFile, PrInfo } from "@/lib/types";

/** A new file whose every line is added. */
export function addedFile(filename: string, lines: string[]): PrFile {
  return {
    filename,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: `@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join("\n")}`,
  };
}

export function prInfo(overrides: Partial<PrInfo> = {}): PrInfo {
  return {
    owner: "acme",
    repo: "shop",
    number: 7,
    title: "Test PR",
    author: "dev",
    url: "https://github.com/acme/shop/pull/7",
    headRepo: "acme/shop",
    headSha: "abc123",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    ...overrides,
  };
}

/** n numbered lines of filler code, indented by `indent` spaces. */
export function filler(n: number, indent = 2): string[] {
  return Array.from({ length: n }, (_, i) => `${" ".repeat(indent)}total += ${i};`);
}
