import { parsePatch, type NewLine } from "../diff";
import { isSourceFile, languageOf } from "../files";
import type { Finding, Rule } from "../types";

export const MAX_FUNCTION_LINES = 50;

const CONTROL = /^\s*(if|for|while|switch|catch|else|do|try|return|with|elif|except|foreach|using|lock|new|throw|await)\b/;

const START_PATTERNS: RegExp[] = [
  // JS/TS: function declarations and expressions
  /^\s*(export\s+)?(default\s+)?(async\s+)?function\b/,
  // JS/TS: const name = (...) => {  /  const name = async x => {
  /^\s*(export\s+)?(const|let|var)\s+[A-Za-z_$][\w$]*\s*(:[^=]+)?=\s*(async\s+)?(function\b|\([^)]*\)?|[A-Za-z_$][\w$]*\s*=>)/,
  // Go
  /^\s*func\s+(\([^)]*\)\s*)?[A-Za-z_]\w*\s*\(/,
  // Java / C# / C++ / Kotlin / Rust / Swift / JS class methods: [modifiers] [type] name(args) [...] {
  /^\s*([A-Za-z_$][\w$<>[\],.?*&:]*\s+)*\*?&?[A-Za-z_$][\w$]*\s*\([^;]*\)?\s*[^;=]*\{?\s*$/,
];

function looksLikeFunctionStart(text: string): boolean {
  if (CONTROL.test(text) || !text.includes("(")) return false;
  if (/^\s*(\/\/|\*|\/\*|#)/.test(text)) return false;
  return START_PATTERNS.some((p) => p.test(text));
}

function functionName(text: string): string {
  const arrow = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(text);
  if (arrow) return arrow[1];
  const fn = /function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(text);
  if (fn) return fn[1];
  const call = /([A-Za-z_$][\w$]*)\s*\(/.exec(text.replace(/^\s*func\s+\([^)]*\)\s*/, ""));
  return call ? call[1] : "anonymous";
}

/** Remove string literals and line comments so braces inside them are not counted. */
function codeOnly(text: string): string {
  return text
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""')
    .replace(/\/\/.*$/, "");
}

interface Span {
  name: string;
  start: number;
  end: number;
  /** False when the hunk ends before the function closes, so the real length is at least end - start + 1. */
  complete: boolean;
  added: number;
  startAdded: boolean;
}

function braceSpans(lines: NewLine[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!looksLikeFunctionStart(lines[i].text)) continue;
    let depth = 0;
    let opened = false;
    let j = i;
    for (; j < lines.length; j++) {
      for (const ch of codeOnly(lines[j].text)) {
        if (ch === "{") {
          depth++;
          opened = true;
        } else if (ch === "}") depth--;
      }
      if (!opened && j - i >= 2) break; // no body brace soon after: not a block function
      if (opened && depth <= 0) break;
    }
    if (!opened) continue;
    const complete = j < lines.length;
    const last = lines[Math.min(j, lines.length - 1)];
    const body = lines.slice(i, Math.min(j, lines.length - 1) + 1);
    spans.push({
      name: functionName(lines[i].text),
      start: lines[i].number,
      end: last.number,
      complete,
      added: body.filter((l) => l.added).length,
      startAdded: lines[i].added,
    });
  }
  return spans;
}

function pythonSpans(lines: NewLine[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(lines[i].text);
    if (!m) continue;
    const indent = m[1].length;
    let lastBody = i;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const t = lines[j].text;
      if (t.trim() === "") continue;
      const lead = t.length - t.trimStart().length;
      if (lead <= indent) break;
      lastBody = j;
    }
    const body = lines.slice(i, lastBody + 1);
    spans.push({
      name: m[3],
      start: lines[i].number,
      end: lines[lastBody].number,
      complete: j < lines.length,
      added: body.filter((l) => l.added).length,
      startAdded: lines[i].added,
    });
  }
  return spans;
}

/** Flags new or mostly rewritten functions longer than MAX_FUNCTION_LINES lines. */
export const longFunctions: Rule = {
  id: "long-function",
  title: "Functions stay small",
  check: `New or rewritten functions are under ${MAX_FUNCTION_LINES} lines`,
  run({ files }) {
    const out: Finding[] = [];
    for (const f of files) {
      if (!isSourceFile(f.filename)) continue;
      const lang = languageOf(f.filename);
      if (lang === "other" || lang === "rb") continue;
      for (const hunk of parsePatch(f.patch)) {
        const spans = lang === "py" ? pythonSpans(hunk.lines) : braceSpans(hunk.lines);
        for (const s of spans) {
          const length = s.end - s.start + 1;
          if (length <= MAX_FUNCTION_LINES) continue;
          if (!s.startAdded && s.added < length / 2) continue; // an old long function the PR barely touched
          out.push({
            rule: "long-function",
            severity: "warning",
            message: `${s.name}() is ${s.complete ? "" : "at least "}${length} lines long (limit ${MAX_FUNCTION_LINES}). Consider splitting it into smaller functions.`,
            file: f.filename,
            line: s.start,
          });
        }
      }
    }
    return out;
  },
};
