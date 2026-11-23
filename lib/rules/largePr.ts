import type { Finding, Rule } from "../types";

export const LARGE_PR_LINES = 400;
export const LARGE_PR_FILES = 30;

/** Flags PRs too big to review well in one sitting. */
export const largePr: Rule = {
  id: "large-pr",
  title: "Reviewable size",
  check: `Under ${LARGE_PR_LINES} changed lines and ${LARGE_PR_FILES} files, or split into smaller PRs`,
  run({ pr, files }) {
    const out: Finding[] = [];
    const lines = pr.additions + pr.deletions;
    if (lines > LARGE_PR_LINES) {
      out.push({
        rule: "large-pr",
        severity: "warning",
        message: `${lines} lines changed (+${pr.additions} / -${pr.deletions}). Consider splitting this PR so each part can be reviewed carefully.`,
      });
    }
    if (pr.changedFiles > LARGE_PR_FILES) {
      out.push({
        rule: "large-pr",
        severity: "warning",
        message: `${pr.changedFiles} files changed. Consider splitting by feature or layer.`,
      });
    }
    const noPatch = files.filter((f) => !f.patch && f.status !== "removed" && f.additions + f.deletions > 0);
    if (noPatch.length > 0) {
      out.push({
        rule: "large-pr",
        severity: "info",
        message: `${noPatch.length} file${noPatch.length === 1 ? " has" : "s have"} no diff from GitHub (binary or too large), so they were not checked: ${noPatch
          .slice(0, 3)
          .map((f) => f.filename)
          .join(", ")}${noPatch.length > 3 ? ", …" : ""}`,
      });
    }
    return out;
  },
};
