import type { FileStatus, PrFile, PrInfo } from "./types";

export interface PrRef {
  owner: string;
  repo: string;
  number: number;
}

const PR_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;

/** Parse "https://github.com/owner/repo/pull/123" (also with /files, query or #fragment) or "owner/repo#123". */
export function parsePrUrl(input: string): PrRef | null {
  const s = input.trim();
  const m = PR_URL.exec(s) ?? /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/.exec(s);
  if (!m) return null;
  const number = Number(m[3]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), number };
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

type Fetch = typeof fetch;

const API = "https://api.github.com";
export const MAX_FILE_PAGES = 3; // 100 files per page → up to 300 files

async function getJson<T>(url: string, fetchImpl: Fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check your connection and try again.", 0);
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) {
    throw new GitHubError("Pull request not found. ReviewLens only reads public repositories, so check the link and that the repo is public.", 404);
  }
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.` : "";
    throw new GitHubError(`GitHub's limit of 60 requests per hour for your network is used up.${when} The sample PRs still work.`, res.status);
  }
  throw new GitHubError(`GitHub returned an error (${res.status}). Try again in a moment.`, res.status);
}

interface ApiPull {
  title: string;
  html_url: string;
  user: { login: string } | null;
  head: { sha: string; repo: { full_name: string } | null };
  additions: number;
  deletions: number;
  changed_files: number;
}

interface ApiFile {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
}

/** Fetch a public PR and its changed files straight from GitHub's REST API (no token). */
export async function fetchPullRequest(ref: PrRef, fetchImpl: Fetch = fetch): Promise<{ pr: PrInfo; files: PrFile[] }> {
  const base = `${API}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`;
  const pull = await getJson<ApiPull>(base, fetchImpl);
  const files: PrFile[] = [];
  for (let page = 1; page <= MAX_FILE_PAGES; page++) {
    const batch = await getJson<ApiFile[]>(`${base}/files?per_page=100&page=${page}`, fetchImpl);
    files.push(...batch.map(({ filename, status, additions, deletions, patch }) => ({ filename, status, additions, deletions, patch })));
    if (batch.length < 100) break;
  }
  const pr: PrInfo = {
    owner: ref.owner,
    repo: ref.repo,
    number: ref.number,
    title: pull.title,
    author: pull.user?.login ?? "unknown",
    url: pull.html_url,
    headRepo: pull.head.repo?.full_name ?? null,
    headSha: pull.head.sha,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
  };
  return { pr, files };
}
