import type { PrFile, PrInfo } from "./types";

/**
 * Made-up pull requests bundled with the app, so the demo works offline and without
 * using the visitor's GitHub API quota. Every key below is fake.
 */

function added(filename: string, lines: string[]): PrFile {
  return {
    filename,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: `@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join("\n")}`,
  };
}

function modified(filename: string, patch: string, additions: number, deletions: number): PrFile {
  return { filename, status: "modified", additions, deletions, patch };
}

function info(number: number, title: string, author: string, files: PrFile[]): PrInfo {
  return {
    owner: "sample",
    repo: "shop-api",
    number,
    title,
    author,
    url: "",
    headRepo: null,
    headSha: "",
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
    changedFiles: files.length,
  };
}

const EVENTS = ["charge.succeeded", "charge.failed", "charge.refunded", "invoice.paid", "invoice.payment_failed", "customer.created", "customer.deleted", "payout.paid"];

const webhook = added("src/payments/webhook.ts", [
  'import { db } from "../db";',
  'import { sendEmail } from "../email";',
  "",
  'const apiKey = "q8Zf2LmN4vR7tY1xKp";',
  "",
  "export async function handleWebhook(req: Request): Promise<Response> {",
  "  const event = await req.json();",
  '  console.log("webhook event", event);',
  "  // TODO: verify the webhook signature before trusting the payload",
  "  const order = await db.orders.findByPaymentId(event.data.id);",
  "  if (!order) {",
  '    return new Response("unknown order", { status: 404 });',
  "  }",
  ...EVENTS.flatMap((type) => [
    `  if (event.type === "${type}") {`,
    `    await db.orders.update(order.id, { lastEvent: "${type}" });`,
    `    await db.audit.insert({ orderId: order.id, type: "${type}", at: Date.now() });`,
    `    await sendEmail(order.customerEmail, "${type}", { orderId: order.id });`,
    '    return new Response("ok");',
    "  }",
  ]),
  '  return new Response("ignored", { status: 202 });',
  "}",
]);

// Split so this fake key does not trip secret scanners on the ReviewLens repo itself.
const FAKE_AWS_KEY = "AKIA" + "Q3XJ7N2LMB5RT8WZ";

const config = added("src/payments/config.ts", [
  "export const paymentsConfig = {",
  '  region: "ap-south-1",',
  `  accessKeyId: "${FAKE_AWS_KEY}",`,
  "  retries: 3,",
  "};",
]);

const readme = modified(
  "README.md",
  "@@ -10,3 +10,5 @@ ## Payments\n Payments are processed by the provider.\n+\n+Webhooks arrive at `/api/payments/webhook`.\n The dashboard shows each order.",
  2,
  0,
);

const dateUtil = modified(
  "src/utils/date.ts",
  [
    "@@ -1,9 +1,10 @@",
    ' import { format } from "date-fns";',
    " ",
    "-export function formatDate(d: Date) {",
    '-  return format(d, "dd/MM/yyyy");',
    "+/** Formats a date for invoices, e.g. 24 Nov 2026. */",
    "+export function formatInvoiceDate(d: Date): string {",
    '+  return format(d, "d MMM yyyy");',
    " }",
    " ",
    " export function isWeekend(d: Date): boolean {",
    "   return d.getDay() === 0 || d.getDay() === 6;",
  ].join("\n"),
  3,
  2,
);

const dateTest = added("src/utils/date.test.ts", [
  'import { describe, expect, it } from "vitest";',
  'import { formatInvoiceDate, isWeekend } from "./date";',
  "",
  'describe("formatInvoiceDate", () => {',
  '  it("uses day, short month and year", () => {',
  '    expect(formatInvoiceDate(new Date(2026, 10, 24))).toBe("24 Nov 2026");',
  "  });",
  "});",
  "",
  'describe("isWeekend", () => {',
  '  it("is true on Sunday", () => {',
  "    expect(isWeekend(new Date(2026, 10, 22))).toBe(true);",
  "  });",
  "});",
]);

const importer = added("app/importer.py", [
  "import csv",
  "",
  "",
  "def import_rows(path, db):",
  '    """Import products from a CSV file."""',
  "    count = 0",
  "    with open(path) as f:",
  "        for row in csv.DictReader(f):",
  '            print("importing", row)',
  "            # FIXME: prices with commas break float()",
  '            db.insert("products", {"sku": row["sku"], "price": float(row["price"])})',
  "            count += 1",
  "    breakpoint()",
  "    return count",
]);

const importerTest = added("tests/test_importer.py", [
  "from app.importer import import_rows",
  "",
  "",
  "def test_import_rows_counts(tmp_path, fake_db):",
  '    f = tmp_path / "p.csv"',
  '    f.write_text("sku,price\\nA1,10\\n")',
  "    assert import_rows(f, fake_db) == 1",
]);

export interface Sample {
  id: string;
  label: string;
  pr: PrInfo;
  files: PrFile[];
}

const s1 = [webhook, config, readme];
const s2 = [dateUtil, dateTest];
const s3 = [importer, importerTest];

export const SAMPLES: Sample[] = [
  { id: "webhook", label: "Payment webhook (TypeScript)", pr: info(42, "Add payment webhook handler", "sample-dev", s1), files: s1 },
  { id: "importer", label: "CSV importer (Python)", pr: info(57, "Add CSV product importer", "sample-dev", s3), files: s3 },
  { id: "dates", label: "Date utils refactor (clean)", pr: info(61, "Rename formatDate and add tests", "sample-dev", s2), files: s2 },
];
