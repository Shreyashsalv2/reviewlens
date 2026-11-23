/** Helpers that classify changed files by path. */

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|go|rb|php|cs|cpp|cc|cxx|c|h|hpp|rs|swift|scala|dart)$/i;

const TEST_PATTERNS: RegExp[] = [
  /(^|\/)(__tests__|tests?|spec|specs)\//i,
  /\.(test|spec)\.[a-z]+$/i,
  /(^|\/)test_[^/]+\.py$/i,
  /_test\.(py|go|rb)$/i,
  /(Test|Tests|IT)\.(java|kt|cs|scala)$/,
  /_spec\.rb$/i,
];

const NON_SOURCE_DIRS = /(^|\/)(docs?|examples?|scripts|\.github|migrations|fixtures|vendor|dist|build)\//i;

export function isTestFile(path: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(path));
}

/** Application code that normally needs tests: a code file that is not a test, config or doc. */
export function isSourceFile(path: string): boolean {
  if (!CODE_EXT.test(path) || isTestFile(path) || NON_SOURCE_DIRS.test(path)) return false;
  const base = path.split("/").pop() ?? path;
  if (/\.(config|conf|d)\.[a-z]+$/i.test(base) || /^(setup|conftest|manage)\.py$/i.test(base)) return false;
  return true;
}

export type Lang = "js" | "py" | "java" | "go" | "rb" | "php" | "c" | "other";

export function languageOf(path: string): Lang {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) return "js";
  if (ext === "py") return "py";
  if (["java", "kt", "scala", "cs"].includes(ext)) return "java";
  if (ext === "go") return "go";
  if (ext === "rb") return "rb";
  if (ext === "php") return "php";
  if (["c", "cc", "cpp", "cxx", "h", "hpp", "rs", "swift", "dart"].includes(ext)) return "c";
  return "other";
}

/** True if the trimmed line is a comment in common languages. */
export function isCommentLine(text: string): boolean {
  const t = text.trim();
  return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("--");
}
