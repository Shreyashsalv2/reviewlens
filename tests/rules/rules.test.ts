import { describe, expect, it } from "vitest";
import { debugPrints } from "@/lib/rules/debugPrints";
import { largePr, LARGE_PR_LINES } from "@/lib/rules/largePr";
import { longFunctions, MAX_FUNCTION_LINES } from "@/lib/rules/longFunctions";
import { missingTests } from "@/lib/rules/missingTests";
import { mask, secrets } from "@/lib/rules/secrets";
import { todos } from "@/lib/rules/todos";
import type { PrFile } from "@/lib/types";
import { addedFile, filler, prInfo } from "../helpers";

const ctx = (files: PrFile[], pr = prInfo()) => ({ pr, files });

describe("missing-tests", () => {
  it("warns when source changes without any test file", () => {
    const out = missingTests.run(ctx([addedFile("src/cart.ts", ["export const x = 1;"])]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rule: "missing-tests", severity: "warning" });
    expect(out[0].message).toContain("src/cart.ts");
  });

  it("passes when a test file is part of the PR", () => {
    expect(missingTests.run(ctx([addedFile("src/cart.ts", ["x"]), addedFile("src/cart.test.ts", ["y"])]))).toEqual([]);
  });

  it("ignores docs-only and config-only PRs", () => {
    expect(missingTests.run(ctx([addedFile("README.md", ["hi"]), addedFile("vite.config.ts", ["x"])]))).toEqual([]);
  });
});

describe("debug-print", () => {
  it("flags console.log and debugger in TypeScript with line numbers", () => {
    const out = debugPrints.run(ctx([addedFile("src/a.ts", ["const a = 1;", 'console.log("a", a);', "debugger;"])]));
    expect(out.map((f) => f.line)).toEqual([2, 3]);
  });

  it("flags print and breakpoint in Python, System.out in Java, fmt.Println in Go", () => {
    const out = debugPrints.run(
      ctx([
        addedFile("app/x.py", ['print("hi")', "breakpoint()"]),
        addedFile("src/main/java/A.java", ['System.out.println("x");']),
        addedFile("cmd/main.go", ['fmt.Println("x")']),
      ]),
    );
    expect(out.map((f) => `${f.file}:${f.line}`)).toEqual(["app/x.py:1", "app/x.py:2", "src/main/java/A.java:1", "cmd/main.go:1"]);
  });

  it("ignores commented-out prints, console.error and test files", () => {
    const out = debugPrints.run(
      ctx([addedFile("src/a.ts", ["// console.log(x)", 'console.error("boom")']), addedFile("src/a.test.ts", ["console.log(1)"])]),
    );
    expect(out).toEqual([]);
  });
});

describe("todo", () => {
  it("lists TODO, FIXME and HACK comments as notes", () => {
    const out = todos.run(ctx([addedFile("src/a.ts", ["// TODO: handle retries", "const ok = true;", "/* FIXME later */", "# HACK around bug"])]));
    expect(out.map((f) => [f.line, f.message, f.severity])).toEqual([
      [1, "New TODO comment.", "info"],
      [3, "New FIXME comment.", "info"],
      [4, "New HACK comment.", "info"],
    ]);
  });

  it("does not match the word inside code", () => {
    expect(todos.run(ctx([addedFile("src/a.ts", ["const todoList = [];", 'const label = "TODO";'])]))).toEqual([]);
  });
});

describe("secret", () => {
  const fakeAws = "AKIA" + "ABCDEFGHIJKLMNOP";
  const fakeGh = "ghp_" + "a".repeat(36);

  it("flags cloud keys and tokens as critical and masks them", () => {
    const out = secrets.run(ctx([addedFile("src/cfg.ts", [`const k = "${fakeAws}";`, `token: "${fakeGh}"`])]));
    expect(out).toHaveLength(2);
    expect(out.every((f) => f.severity === "critical")).toBe(true);
    expect(out[0].message).toContain("Looks like an AWS access key");
    expect(out[1].message).toContain("Looks like a GitHub token");
    expect(out[0].snippet).not.toContain(fakeAws);
    expect(out[1].snippet).not.toContain(fakeGh);
  });

  it("flags hard-coded passwords but not env lookups or placeholders", () => {
    const out = secrets.run(
      ctx([
        addedFile("src/db.py", [
          'password = "hunter2hunter2"',
          'password = os.environ["DB_PASSWORD"]',
          'api_key = "your_api_key_here"',
          'const apiKey = process.env.API_KEY ?? "";',
        ]),
      ]),
    );
    expect(out.map((f) => f.line)).toEqual([1]);
    expect(out[0].snippet).toBe('password = "hunt**********"');
  });

  it("flags private keys and committed .env files, but not .env.example", () => {
    const out = secrets.run(
      ctx([
        addedFile("deploy/key.pem", ["-----BEGIN RSA " + "PRIVATE KEY-----", "MIIEpAIBAAKCAQEA"]),
        addedFile(".env", ["DEBUG=1"]),
        addedFile(".env.example", ["API_KEY="]),
      ]),
    );
    expect(out.map((f) => f.file)).toEqual(["deploy/key.pem", ".env"]);
  });

  it("masks short and long values", () => {
    expect(mask("abc")).toBe("***");
    expect(mask("abcdefghijklmnopqrstuvwxyz")).toBe("abcd************");
  });
});

describe("long-function", () => {
  const long = (n: number) => ["export function processOrder(order) {", "  let total = 0;", ...filler(n), "  return total;", "}"];

  it(`flags a new function over ${MAX_FUNCTION_LINES} lines`, () => {
    const out = longFunctions.run(ctx([addedFile("src/order.ts", long(60))]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rule: "long-function", line: 1, file: "src/order.ts" });
    expect(out[0].message).toMatch(/^processOrder\(\) is 64 lines long/);
  });

  it("does not flag a short function", () => {
    expect(longFunctions.run(ctx([addedFile("src/order.ts", long(10))]))).toEqual([]);
  });

  it("handles arrow functions and class methods", () => {
    const arrow = ["export const build = async (x: number) => {", ...filler(55), "};"];
    const method = ["class Cart {", "  checkout(user: User): Receipt {", ...filler(55, 4), "  }", "}"];
    const out = longFunctions.run(ctx([addedFile("src/a.ts", arrow), addedFile("src/b.ts", method)]));
    expect(out.map((f) => f.message.split("(")[0])).toEqual(["build", "checkout"]);
  });

  it("measures Python functions by indentation", () => {
    const py = ["def import_rows(path):", ...filler(55, 4).map((l) => l.replace(";", "")), "", "def small():", "    return 1"];
    const out = longFunctions.run(ctx([addedFile("app/x.py", py)]));
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/^import_rows\(\) is 56 lines long/);
  });

  it("says 'at least' when the hunk ends before the function does", () => {
    const out = longFunctions.run(ctx([addedFile("src/a.ts", ["function open() {", ...filler(60)])]));
    expect(out[0].message).toMatch(/at least 61 lines/);
  });

  it("ignores braces inside strings and if-blocks that look like calls", () => {
    const code = ["function f() {", '  const s = "}}}";', "  if (x) {", "    y();", "  }", ...filler(55), "}"];
    const out = longFunctions.run(ctx([addedFile("src/a.ts", code)]));
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/^f\(\) is 61 lines long/);
  });
});

describe("large-pr", () => {
  it("passes a small PR", () => {
    expect(largePr.run(ctx([], prInfo({ additions: 50, deletions: 10, changedFiles: 3 })))).toEqual([]);
  });

  it(`warns over ${LARGE_PR_LINES} changed lines and over 30 files`, () => {
    const out = largePr.run(ctx([], prInfo({ additions: 380, deletions: 40, changedFiles: 31 })));
    expect(out.map((f) => f.severity)).toEqual(["warning", "warning"]);
    expect(out[0].message).toContain("420 lines changed");
  });

  it("notes files GitHub sent without a diff", () => {
    const bin: PrFile = { filename: "logo.png", status: "added", additions: 0, deletions: 0 };
    const huge: PrFile = { filename: "data.json", status: "modified", additions: 9000, deletions: 10 };
    const out = largePr.run(ctx([bin, huge]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ severity: "info" });
    expect(out[0].message).toContain("data.json");
  });
});
