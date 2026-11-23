"use client";

import { useState } from "react";
import { fetchPullRequest, GitHubError, parsePrUrl } from "@/lib/github";
import { buildReport, countsLine, lineUrl, plural, toMarkdown, VERDICT_LABEL, type Report } from "@/lib/report";
import { SAMPLES } from "@/lib/samples";
import type { Finding, Severity } from "@/lib/types";

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-800",
  warning: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  info: "bg-sky-100 text-sky-900 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
};

const VERDICT_STYLE = {
  "needs-changes": "bg-red-600 text-white",
  "review-carefully": "bg-amber-500 text-black",
  "looks-clean": "bg-emerald-600 text-white",
} as const;

export default function ReviewApp() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);

  async function review(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    const ref = parsePrUrl(input);
    if (!ref) {
      setError("Paste a pull request link like https://github.com/owner/repo/pull/123");
      return;
    }
    setLoading(true);
    try {
      const { pr, files } = await fetchPullRequest(ref);
      setReport(buildReport(pr, files));
    } catch (err) {
      setReport(null);
      setError(err instanceof GitHubError ? err.message : "Something went wrong while reading the PR.");
    } finally {
      setLoading(false);
    }
  }

  function loadSample(id: string) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setError(null);
    setCopied(false);
    setInput("");
    setReport(buildReport(s.pr, s.files));
  }

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(report));
      setCopied(true);
    } catch {
      setError("Could not copy to the clipboard in this browser.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-14">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Pull-request review helper</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Review<span className="text-indigo-600 dark:text-indigo-400">Lens</span>
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Paste a public GitHub pull request and get a review checklist: missing tests, long functions, leftover debug
          prints, new TODOs, secret-looking strings and oversized PRs.
        </p>
      </header>

      <form onSubmit={review} className="flex flex-col gap-3 sm:flex-row" aria-label="Review a pull request">
        <label htmlFor="pr-url" className="sr-only">
          Pull request URL
        </label>
        <input
          id="pr-url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-indigo-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Reading PR…" : "Review PR"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Or try a sample PR:</span>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.id)}
            className="rounded-full border border-zinc-300 px-3 py-1 hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:hover:text-indigo-400"
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {report && <ReportView report={report} onCopy={copy} copied={copied} />}

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        Rule-based checks that run in your browser. Public repositories only; GitHub allows 60 requests per hour per
        network without sign-in. Sample PRs are made up and work offline.
      </footer>
    </main>
  );
}

function ReportView({ report, onCopy, copied }: { report: Report; onCopy: () => void; copied: boolean }) {
  const { pr, checklist, findings, counts, verdict } = report;
  const sample = !pr.url;
  return (
    <section className="mt-10" aria-label="Review report">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-500">
            {pr.owner}/{pr.repo} #{pr.number} · by {pr.author}
            {sample && " · sample"}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {sample ? (
              pr.title
            ) : (
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {pr.title}
              </a>
            )}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="text-emerald-600">+{pr.additions}</span> / <span className="text-red-600">-{pr.deletions}</span> ·{" "}
            {plural(pr.changedFiles, "file")} · {countsLine(counts)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${VERDICT_STYLE[verdict]}`}>{VERDICT_LABEL[verdict]}</span>
          <button type="button" onClick={onCopy} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:border-indigo-500 dark:border-zinc-700">
            {copied ? "Copied ✓" : "Copy as Markdown"}
          </button>
        </div>
      </div>

      <h3 className="mt-8 mb-3 font-semibold">Checklist</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {checklist.map((c) => (
          <li key={c.rule} className="flex items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span aria-hidden="true" className={`mt-0.5 text-lg ${c.passed ? "text-emerald-600" : c.worst === "critical" ? "text-red-600" : "text-amber-500"}`}>
              {c.passed ? "✓" : "✗"}
            </span>
            <span>
              <span className="block text-sm font-medium">
                {c.title}
                <span className="sr-only">{c.passed ? " passed" : " needs attention"}</span>
                {c.count > 0 && <span className="ml-2 font-mono text-xs text-zinc-500">{c.count}</span>}
              </span>
              <span className="block text-xs text-zinc-500">{c.check}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 mb-3 font-semibold">Findings</h3>
      {findings.length === 0 ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          No issues found by the automated checks. Logic and design still need a human reviewer.
        </p>
      ) : (
        <ul className="space-y-3">
          {findings.map((f, i) => (
            <FindingItem key={i} f={f} href={sample ? null : lineUrl(pr, f.file, f.line)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FindingItem({ f, href }: { f: Finding; href: string | null }) {
  const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : null;
  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ring-1 ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
        {where &&
          (href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              {where}
            </a>
          ) : (
            <span className="break-all font-mono text-xs text-zinc-500">{where}</span>
          ))}
      </div>
      <p className="mt-2 text-sm">{f.message}</p>
      {f.snippet && <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 px-3 py-2 font-mono text-xs dark:bg-zinc-900">{f.snippet}</pre>}
    </li>
  );
}
