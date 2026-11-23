export type Severity = "critical" | "warning" | "info";

export type FileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";

/** One changed file in a pull request, shaped like GitHub's "list pull request files" response. */
export interface PrFile {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  /** Unified diff for this file. Missing for binary files and very large diffs. */
  patch?: string;
}

export interface PrInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  /** "owner/repo" of the branch the PR comes from (may be a fork); null if that repo was deleted. */
  headRepo: string | null;
  headSha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface Finding {
  rule: RuleId;
  severity: Severity;
  message: string;
  file?: string;
  /** Line number in the new version of the file. */
  line?: number;
  /** The offending line (secrets are masked). */
  snippet?: string;
}

export type RuleId = "missing-tests" | "long-function" | "debug-print" | "todo" | "secret" | "large-pr";

export interface RuleContext {
  pr: PrInfo;
  files: PrFile[];
}

export interface Rule {
  id: RuleId;
  title: string;
  /** What the reviewer is checking for, shown in the checklist. */
  check: string;
  run(ctx: RuleContext): Finding[];
}
