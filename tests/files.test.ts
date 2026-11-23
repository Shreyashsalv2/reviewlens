import { describe, expect, it } from "vitest";
import { isCommentLine, isSourceFile, isTestFile, languageOf } from "@/lib/files";

describe("isTestFile", () => {
  it.each([
    "src/app.test.ts",
    "src/app.spec.tsx",
    "tests/test_api.py",
    "pkg/server_test.go",
    "src/test/java/com/acme/OrderServiceTest.java",
    "__tests__/cart.js",
    "spec/models/user_spec.rb",
  ])("recognises %s as a test", (p) => expect(isTestFile(p)).toBe(true));

  it.each(["src/app.ts", "src/contest.py", "src/attestation.go"])("does not treat %s as a test", (p) => expect(isTestFile(p)).toBe(false));
});

describe("isSourceFile", () => {
  it("accepts application code", () => {
    expect(isSourceFile("src/payments/webhook.ts")).toBe(true);
    expect(isSourceFile("app/importer.py")).toBe(true);
    expect(isSourceFile("src/main/java/com/acme/Order.java")).toBe(true);
  });

  it("rejects tests, docs, config and non-code files", () => {
    expect(isSourceFile("src/app.test.ts")).toBe(false);
    expect(isSourceFile("README.md")).toBe(false);
    expect(isSourceFile("next.config.ts")).toBe(false);
    expect(isSourceFile("types/global.d.ts")).toBe(false);
    expect(isSourceFile("docs/example.py")).toBe(false);
    expect(isSourceFile("package.json")).toBe(false);
  });
});

describe("languageOf / isCommentLine", () => {
  it("maps extensions to rule languages", () => {
    expect(languageOf("a.tsx")).toBe("js");
    expect(languageOf("a.py")).toBe("py");
    expect(languageOf("A.java")).toBe("java");
    expect(languageOf("main.go")).toBe("go");
    expect(languageOf("x.yaml")).toBe("other");
  });

  it("spots comment lines", () => {
    expect(isCommentLine("  // console.log(x)")).toBe(true);
    expect(isCommentLine("# print(x)")).toBe(true);
    expect(isCommentLine("console.log(x)")).toBe(false);
  });
});
