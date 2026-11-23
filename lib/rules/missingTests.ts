import { isSourceFile, isTestFile } from "../files";
import type { Rule } from "../types";

/** Flags a PR that changes application code without touching any test file. */
export const missingTests: Rule = {
  id: "missing-tests",
  title: "Tests updated",
  check: "Code changes come with new or updated tests",
  run({ files }) {
    const source = files.filter((f) => f.status !== "removed" && isSourceFile(f.filename) && f.additions > 0);
    if (source.length === 0) return [];
    if (files.some((f) => isTestFile(f.filename))) return [];
    const names = source.slice(0, 3).map((f) => f.filename).join(", ");
    const more = source.length > 3 ? ` and ${source.length - 3} more` : "";
    return [
      {
        rule: "missing-tests",
        severity: "warning",
        message: `${source.length} source file${source.length === 1 ? "" : "s"} changed (${names}${more}) but no test file was added or updated.`,
      },
    ];
  },
};
