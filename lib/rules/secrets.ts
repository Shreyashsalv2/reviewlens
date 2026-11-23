import { addedLines } from "../diff";
import type { Finding, Rule } from "../types";

interface SecretPattern {
  name: string;
  re: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "AWS access key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: "OpenAI-style API key", re: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "Stripe live key", re: /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "hard-coded credential",
    re: /\b[\w-]*(api[_-]?key|secret|passw(or)?d|token|auth)[\w-]*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i,
  },
];

const PLACEHOLDER = /(your[_-]|example|changeme|placeholder|dummy|sample|xxxx|<[^>]+>|\$\{|process\.env|os\.environ|getenv|\*\*\*)/i;

/** Hide most of a secret so the report never repeats it. */
export function mask(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 4, 12))}`;
}

function maskLine(text: string, match: string): string {
  return text.replace(match, mask(match)).trim();
}

/** Flags strings that look like real credentials, plus committed .env files. */
export const secrets: Rule = {
  id: "secret",
  title: "No secrets committed",
  check: "No API keys, tokens, passwords or private keys in the diff",
  run({ files }) {
    const out: Finding[] = [];
    for (const f of files) {
      const base = f.filename.split("/").pop() ?? "";
      if (/^\.env(\.(?!example|sample|template)[\w.-]+)?$/.test(base) && f.status !== "removed") {
        out.push({
          rule: "secret",
          severity: "critical",
          message: `Environment file ${base} is committed. Keep it out of git and add it to .gitignore.`,
          file: f.filename,
        });
      }
      for (const line of addedLines(f.patch)) {
        for (const p of SECRET_PATTERNS) {
          const m = p.re.exec(line.text);
          if (!m) continue;
          const value = p.name === "hard-coded credential" ? m[3] : m[0];
          if (PLACEHOLDER.test(line.text) || PLACEHOLDER.test(value)) continue;
          out.push({
            rule: "secret",
            severity: "critical",
            message: `Looks like ${/^[aeiou]/i.test(p.name) ? "an" : "a"} ${p.name}. Remove it, rotate it, and load it from an environment variable.`,
            file: f.filename,
            line: line.number,
            snippet: maskLine(line.text, value),
          });
          break;
        }
      }
    }
    return out;
  },
};
