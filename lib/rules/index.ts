import type { Finding, Rule, RuleContext } from "../types";
import { debugPrints } from "./debugPrints";
import { largePr } from "./largePr";
import { longFunctions } from "./longFunctions";
import { missingTests } from "./missingTests";
import { secrets } from "./secrets";
import { todos } from "./todos";

/** Order = order of the checklist: most serious first. */
export const RULES: Rule[] = [secrets, missingTests, longFunctions, debugPrints, todos, largePr];

const RANK = { critical: 0, warning: 1, info: 2 } as const;

export function runRules(ctx: RuleContext, rules: Rule[] = RULES): Finding[] {
  return rules
    .flatMap((r) => r.run(ctx))
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.file ?? "").localeCompare(b.file ?? "") || (a.line ?? 0) - (b.line ?? 0));
}
