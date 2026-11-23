/** A line as it appears in the new version of a file, taken from a unified diff hunk. */
export interface NewLine {
  /** Line number in the new file (1-based). */
  number: number;
  text: string;
  /** True if the PR added this line, false if it is unchanged context. */
  added: boolean;
}

export interface Hunk {
  newStart: number;
  lines: NewLine[];
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parse a unified diff patch (GitHub's `patch` field) into hunks of new-file lines.
 * Removed lines are dropped, because reviewers comment on the code that will exist after the merge.
 */
export function parsePatch(patch: string | undefined): Hunk[] {
  if (!patch) return [];
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let next = 0;
  for (const raw of patch.split("\n")) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      next = Number(header[1]);
      current = { newStart: next, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
    const sign = raw[0];
    if (sign === "-") continue;
    if (sign === "+" || sign === " " || raw === "") {
      current.lines.push({ number: next, text: raw.slice(1), added: sign === "+" });
      next += 1;
    }
  }
  return hunks;
}

/** Every line the PR adds to a file, with its new line number. */
export function addedLines(patch: string | undefined): NewLine[] {
  return parsePatch(patch).flatMap((h) => h.lines.filter((l) => l.added));
}
