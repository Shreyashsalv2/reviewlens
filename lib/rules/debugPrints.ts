import { addedLines } from "../diff";
import { isCommentLine, isSourceFile, languageOf, type Lang } from "../files";
import type { Finding, Rule } from "../types";

const PATTERNS: Record<Lang, RegExp[]> = {
  js: [/\bconsole\.(log|debug|trace|dir)\s*\(/, /^\s*debugger\s*;?\s*$/],
  py: [/^\s*print\s*\(/, /\bpdb\.set_trace\s*\(/, /^\s*breakpoint\s*\(\s*\)/],
  java: [/\bSystem\.(out|err)\.print(ln|f)?\s*\(/, /\.printStackTrace\s*\(\s*\)/],
  go: [/\bfmt\.Print(ln|f)?\s*\(/],
  rb: [/^\s*(puts|p)\s/, /\bbinding\.pry\b/],
  php: [/\b(var_dump|print_r)\s*\(/, /\bdd\s*\(/],
  c: [/\bstd::cout\s*<</, /\bprintln!\s*\(/, /\bdbg!\s*\(/],
  other: [],
};

/** Flags debugging output left in application code (tests and scripts are allowed to print). */
export const debugPrints: Rule = {
  id: "debug-print",
  title: "No leftover debug output",
  check: "No console.log / print / System.out.println / debugger left in app code",
  run({ files }) {
    const out: Finding[] = [];
    for (const f of files) {
      if (!isSourceFile(f.filename)) continue;
      const patterns = PATTERNS[languageOf(f.filename)];
      for (const line of addedLines(f.patch)) {
        if (isCommentLine(line.text)) continue;
        if (patterns.some((p) => p.test(line.text))) {
          out.push({
            rule: "debug-print",
            severity: "warning",
            message: "Debug output left in the code.",
            file: f.filename,
            line: line.number,
            snippet: line.text.trim(),
          });
        }
      }
    }
    return out;
  },
};
