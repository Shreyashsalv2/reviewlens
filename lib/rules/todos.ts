import { addedLines } from "../diff";
import type { Finding, Rule } from "../types";

const MARKER = /(\/\/|#|\/\*|\*|--|<!--)\s*.*\b(TODO|FIXME|HACK|XXX)\b/;

/** Lists TODO / FIXME / HACK / XXX comments the PR introduces, so they get a ticket or get done. */
export const todos: Rule = {
  id: "todo",
  title: "No new TODOs",
  check: "No new TODO / FIXME / HACK comments without a ticket",
  run({ files }) {
    const out: Finding[] = [];
    for (const f of files) {
      for (const line of addedLines(f.patch)) {
        const m = MARKER.exec(line.text);
        if (!m) continue;
        out.push({
          rule: "todo",
          severity: "info",
          message: `New ${m[2]} comment.`,
          file: f.filename,
          line: line.number,
          snippet: line.text.trim(),
        });
      }
    }
    return out;
  },
};
