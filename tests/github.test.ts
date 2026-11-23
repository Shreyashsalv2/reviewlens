import { describe, expect, it, vi } from "vitest";
import { fetchPullRequest, GitHubError, parsePrUrl } from "@/lib/github";

describe("parsePrUrl", () => {
  it.each([
    ["https://github.com/vercel/next.js/pull/123", { owner: "vercel", repo: "next.js", number: 123 }],
    ["github.com/a/b/pull/9/files", { owner: "a", repo: "b", number: 9 }],
    ["https://www.github.com/a/b/pull/9?diff=split#discussion", { owner: "a", repo: "b", number: 9 }],
    ["  a-b/c_d#42  ", { owner: "a-b", repo: "c_d", number: 42 }],
  ])("parses %s", (url, expected) => expect(parsePrUrl(url)).toEqual(expected));

  it.each(["", "https://github.com/a/b", "https://github.com/a/b/issues/3", "https://gitlab.com/a/b/pull/1", "https://github.com/a/b/pull/0"])(
    "rejects %s",
    (url) => expect(parsePrUrl(url)).toBeNull(),
  );
});

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

const PULL = {
  title: "Add cart",
  html_url: "https://github.com/a/b/pull/5",
  user: { login: "dev" },
  head: { sha: "deadbeef", repo: { full_name: "fork/b" } },
  additions: 12,
  deletions: 3,
  changed_files: 2,
};

describe("fetchPullRequest", () => {
  it("maps the PR and its files", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/pulls/5")) return json(PULL);
      return json([{ filename: "src/cart.ts", status: "added", additions: 12, deletions: 0, patch: "@@ -0,0 +1 @@\n+x", sha: "ignored" }]);
    });
    const { pr, files } = await fetchPullRequest({ owner: "a", repo: "b", number: 5 }, fetchMock as unknown as typeof fetch);
    expect(pr).toMatchObject({ title: "Add cart", author: "dev", headRepo: "fork/b", headSha: "deadbeef", changedFiles: 2 });
    expect(files).toEqual([{ filename: "src/cart.ts", status: "added", additions: 12, deletions: 0, patch: "@@ -0,0 +1 @@\n+x" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/pulls/5/files?per_page=100&page=1");
  });

  it("pages through files until a short page", async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ filename: `f${i}.ts`, status: "modified", additions: 1, deletions: 0 }));
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/pulls/5")) return json(PULL);
      return json(u.endsWith("&page=1") ? page(100) : page(7));
    });
    const { files } = await fetchPullRequest({ owner: "a", repo: "b", number: 5 }, fetchMock as unknown as typeof fetch);
    expect(files).toHaveLength(107);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("explains a missing or private PR", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 404 }));
    await expect(fetchPullRequest({ owner: "a", repo: "b", number: 1 }, fetchMock as unknown as typeof fetch)).rejects.toThrow(/only reads public repositories/);
  });

  it("explains GitHub's rate limit", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1795480000" } }));
    const err = await fetchPullRequest({ owner: "a", repo: "b", number: 1 }, fetchMock as unknown as typeof fetch).catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err.message).toMatch(/60 requests per hour/);
    expect(err.status).toBe(403);
  });

  it("reports network failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await expect(fetchPullRequest({ owner: "a", repo: "b", number: 1 }, fetchMock as unknown as typeof fetch)).rejects.toThrow(/Could not reach GitHub/);
  });
});
