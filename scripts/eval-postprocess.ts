#!/usr/bin/env bun
/**
 * Eval harness for the built-in local post-processing model.
 *
 * Mirrors src-tauri's post_process_with_local_llm() pipeline exactly
 * (prompt scaffolding, punctuation strip, sampling params, output guards)
 * using scripts/eval/prompt-fixture.json — which a Rust unit test keeps in
 * sync with the code — then runs a case suite against a llama-server it
 * spawns from the same runtime + GGUF the app uses.
 *
 * Failure categories:
 *   ignored  — instruction not followed (filler kept, list not formed, ...)
 *   invented — output contains words that were not in the input
 *   weird    — output that would paste broken text (wrong language, leaked
 *              scaffolding, thinking tags)
 *   fallback — a production guard tripped (length ratio, empty, unterminated
 *              thinking): the app would paste the RAW transcript instead
 *
 * Usage:
 *   bun scripts/eval-postprocess.ts                         # suite, default model
 *   bun scripts/eval-postprocess.ts --gguf a.gguf --gguf b.gguf   # A/B compare
 *   bun scripts/eval-postprocess.ts --from-history 20       # replay your own dictations
 *   bun scripts/eval-postprocess.ts --only nl-filler        # subset by id substring
 *   bun scripts/eval-postprocess.ts --port 8642             # reuse a running server
 * Options: --fixture <p> --suite <p> --ctx <n> --json <out> --verbose --models-dir <p>
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

// ---------- CLI ----------

interface Args {
  ggufs: string[];
  fixture: string;
  suite: string;
  fromHistory: number | null;
  port: number | null;
  ctx: number | null;
  json: string | null;
  verbose: boolean;
  only: string | null;
  modelsDir: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    ggufs: [],
    fixture: "scripts/eval/prompt-fixture.json",
    suite: "scripts/eval/cases.jsonl",
    fromHistory: null,
    port: null,
    ctx: null,
    json: null,
    verbose: false,
    only: null,
    modelsDir: defaultModelsDir(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      i++;
      if (i >= argv.length) throw new Error(`missing value for ${a}`);
      return argv[i];
    };
    if (a === "--gguf") args.ggufs.push(next());
    else if (a === "--fixture") args.fixture = next();
    else if (a === "--suite") args.suite = next();
    else if (a === "--from-history") args.fromHistory = parseInt(next(), 10);
    else if (a === "--port") args.port = parseInt(next(), 10);
    else if (a === "--ctx") args.ctx = parseInt(next(), 10);
    else if (a === "--json") args.json = next();
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--only") args.only = next();
    else if (a === "--models-dir") args.modelsDir = next();
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function defaultModelsDir(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library/Application Support/com.pais.MomentumTalk/models");
  }
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? "", "com.pais.MomentumTalk/models");
  }
  return join(homedir(), ".local/share/com.pais.MomentumTalk/models");
}

// ---------- Production pipeline mirror (keep in sync with src-tauri) ----------

interface Fixture {
  systemPromptTemplate: string;
  userMessageTemplate: string;
  fewShot: [string, string][];
  params: {
    temperature: number;
    maxTokensMin: number;
    maxTokensMax: number;
    maxInputChars: number;
    lengthRatioMin: number;
    lengthRatioMax: number;
    serverCtxSize: number;
    modelFilename: string;
  };
}

/** actions.rs strip_transcript_punctuation() */
function stripTranscriptPunctuation(text: string): string {
  let out = "";
  let prevSpace = false;
  for (const ch of text) {
    if (".,!?;:".includes(ch)) continue;
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      prevSpace = true;
      out += " ";
    } else {
      prevSpace = false;
      out += ch;
    }
  }
  return out.trim();
}

/** actions.rs strip_invisible_chars() */
function stripInvisibleChars(s: string): string {
  return s.replace(/[​‌‍﻿]/g, "");
}

function substituteCustomWords(template: string, customWords: string[]): string {
  if (!template.includes("${custom_words}")) return template;
  const words = customWords.length === 0 ? "(none)" : customWords.join(", ");
  return template.replaceAll("${custom_words}", words);
}

function buildMessages(fixture: Fixture, raw: string, customWords: string[]) {
  const systemPrompt = substituteCustomWords(fixture.systemPromptTemplate, customWords)
    .replaceAll("${output}", "")
    .trim();
  const words = customWords.length === 0 ? "(none)" : customWords.join(", ");
  const userContent = fixture.userMessageTemplate
    .replaceAll("${custom_words}", words)
    .replaceAll("${transcript}", stripTranscriptPunctuation(raw));
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const [input, output] of fixture.fewShot) {
    messages.push({ role: "user", content: input });
    messages.push({ role: "assistant", content: output });
  }
  messages.push({ role: "user", content: userContent });
  return messages;
}

interface PipelineResult {
  pasted: string; // what the app would paste
  fallback: string | null; // reason a production guard kept the raw text
  rawModelOutput: string;
}

/** Everything post_process_with_local_llm() does to the model response. */
function applyOutputGuards(fixture: Fixture, raw: string, content: string): PipelineResult {
  let cleaned = stripInvisibleChars(content.trim());
  if (cleaned.startsWith("<think>")) {
    const idx = cleaned.indexOf("</think>");
    if (idx === -1) {
      return { pasted: raw, fallback: "unterminated thinking block", rawModelOutput: content };
    }
    cleaned = cleaned.slice(idx + "</think>".length).trim();
  }
  if (cleaned.length === 0) {
    return { pasted: raw, fallback: "empty response", rawModelOutput: content };
  }
  const inputLen = Math.max([...raw].length, 1);
  const outputLen = [...cleaned].length;
  const ratio = outputLen / inputLen;
  if (ratio < fixture.params.lengthRatioMin || ratio > fixture.params.lengthRatioMax) {
    return {
      pasted: raw,
      fallback: `length ratio ${ratio.toFixed(2)} outside [${fixture.params.lengthRatioMin}, ${fixture.params.lengthRatioMax}]`,
      rawModelOutput: content,
    };
  }
  return { pasted: cleaned, fallback: null, rawModelOutput: content };
}

// ---------- llama-server management (mirrors managers/local_llm.rs) ----------

function findServerBinary(runtimeDir: string): string | null {
  const name = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const direct = join(runtimeDir, name);
  if (existsSync(direct)) return direct;
  for (const entry of readdirSync(runtimeDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const candidate = join(runtimeDir, entry.name, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("failed to get port")));
      }
    });
  });
}

interface Server {
  port: number;
  proc: ChildProcess | null;
}

async function startServer(
  ggufPath: string,
  runtimeDir: string,
  ctxSize: number,
): Promise<Server> {
  const bin = findServerBinary(runtimeDir);
  if (!bin) throw new Error(`llama-server binary not found in ${runtimeDir}`);
  const port = await findFreePort();
  const stderrTail: string[] = [];
  // Same args as LocalLlmManager::spawn_server()
  const proc = spawn(
    bin,
    [
      "-m", ggufPath,
      "--host", "127.0.0.1",
      "--port", String(port),
      "--ctx-size", String(ctxSize),
      "-ngl", "99",
      "--chat-template-kwargs", '{"enable_thinking":false}',
      "--no-webui",
    ],
    { cwd: runtimeDir, stdio: ["ignore", "ignore", "pipe"] },
  );
  proc.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) {
        stderrTail.push(line);
        if (stderrTail.length > 20) stderrTail.shift();
      }
    }
  });
  let exited = false;
  proc.on("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`llama-server exited during startup:\n${stderrTail.join("\n")}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return { port, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill("SIGKILL");
  throw new Error(`llama-server health check timed out:\n${stderrTail.join("\n")}`);
}

async function runModel(
  fixture: Fixture,
  port: number,
  raw: string,
  customWords: string[],
): Promise<PipelineResult> {
  if ([...raw].length > fixture.params.maxInputChars) {
    return { pasted: raw, fallback: "input too long (12k char gate)", rawModelOutput: "" };
  }
  const messages = buildMessages(fixture, raw, customWords);
  // max_tokens mirror: transcription.len() in Rust is BYTES
  const byteLen = Buffer.byteLength(raw, "utf8");
  const maxTokens = Math.min(
    Math.max(Math.floor(byteLen / 2), fixture.params.maxTokensMin),
    fixture.params.maxTokensMax,
  );
  const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local",
      messages,
      temperature: fixture.params.temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`chat/completions failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "";
  return applyOutputGuards(fixture, raw, content);
}

// ---------- Checks ----------

interface EvalCase {
  id: string;
  group: string;
  lang: "nl" | "en";
  raw: string;
  customWords?: string[];
  mustMatch?: string[];
  mustNotMatch?: string[];
  allowInsert?: string[];
  maxInvented?: number;
  maxLengthRatio?: number;
  notes?: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .split(" ")
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length > 0);
}

function multisetDiff(a: string[], b: string[]): string[] {
  // tokens in `a` beyond their count in `b`
  const counts = new Map<string, number>();
  for (const t of b) counts.set(t, (counts.get(t) ?? 0) + 1);
  const excess: string[] = [];
  for (const t of a) {
    const c = counts.get(t) ?? 0;
    if (c > 0) counts.set(t, c - 1);
    else excess.push(t);
  }
  return excess;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** Excess output tokens that cannot be explained as list markers, spelled-number
 * conversions, small inflection fixes of a replaced input token, or explicitly
 * allowed insertions. These are the "invented content" signal. */
function inventedWords(raw: string, output: string, allowInsert: string[]): string[] {
  const inTokens = tokenize(raw);
  const outTokens = tokenize(output);
  const inserted = multisetDiff(outTokens, inTokens);
  const removed = multisetDiff(inTokens, outTokens);
  const allow = new Set(allowInsert.map((w) => w.toLowerCase()));
  return inserted.filter((tok) => {
    if (allow.has(tok)) return false;
    if (/^\p{N}{1,4}$/u.test(tok)) return false; // list markers / number-word conversion
    return !removed.some((r) => editDistance(tok, r) <= 2);
  });
}

const NL_STOPWORDS = new Set("de het een en van ik we je dat dit niet is zijn op met voor maar ook nog wel dus naar bij om als dan wat".split(" "));
const EN_STOPWORDS = new Set("the a an and of i we you that this not is are on with for but also still so to at it they what then if".split(" "));

function languageOf(text: string): "nl" | "en" | "unknown" {
  const tokens = tokenize(text);
  let nl = 0;
  let en = 0;
  for (const t of tokens) {
    if (NL_STOPWORDS.has(t)) nl++;
    if (EN_STOPWORDS.has(t)) en++;
  }
  if (nl >= 2 && nl > en * 1.5) return "nl";
  if (en >= 2 && en > nl * 1.5) return "en";
  return "unknown";
}

interface CaseResult {
  id: string;
  group: string;
  status: "pass" | "fail" | "fallback";
  categories: string[];
  violations: string[];
  invented: string[];
  output: string;
  fallbackReason: string | null;
}

function checkCase(fixture: Fixture, c: EvalCase, result: PipelineResult): CaseResult {
  if (result.fallback) {
    return {
      id: c.id,
      group: c.group,
      status: "fallback",
      categories: ["fallback"],
      violations: [`guard tripped: ${result.fallback} (app pastes raw text)`],
      invented: [],
      output: result.rawModelOutput,
      fallbackReason: result.fallback,
    };
  }
  const out = result.pasted;
  const violations: string[] = [];
  const categories = new Set<string>();

  for (const pattern of c.mustMatch ?? []) {
    if (!new RegExp(pattern, "mu").test(out)) {
      violations.push(`mustMatch failed: /${pattern}/`);
      categories.add("ignored");
    }
  }
  for (const pattern of c.mustNotMatch ?? []) {
    if (new RegExp(pattern, "mu").test(out)) {
      violations.push(`mustNotMatch failed: /${pattern}/`);
      categories.add("ignored");
    }
  }

  const invented = inventedWords(c.raw, out, c.allowInsert ?? []);
  if (invented.length > (c.maxInvented ?? 0)) {
    violations.push(`invented words: ${invented.join(", ")}`);
    categories.add("invented");
  }

  const inLang = languageOf(c.raw);
  const outLang = languageOf(out);
  if (inLang !== "unknown" && outLang !== "unknown" && inLang !== outLang) {
    violations.push(`language switched: ${inLang} -> ${outLang}`);
    categories.add("weird");
  }
  if (/Custom words:|Transcript:/.test(out)) {
    violations.push("scaffolding leaked into output");
    categories.add("weird");
  }
  if (c.maxLengthRatio) {
    const ratio = [...out].length / Math.max([...c.raw].length, 1);
    if (ratio > c.maxLengthRatio) {
      violations.push(`length ratio ${ratio.toFixed(2)} > case limit ${c.maxLengthRatio}`);
      categories.add("weird");
    }
  }

  return {
    id: c.id,
    group: c.group,
    status: violations.length === 0 ? "pass" : "fail",
    categories: [...categories],
    violations,
    invented,
    output: out,
    fallbackReason: null,
  };
}

// ---------- Reporting ----------

function wordDiffSummary(raw: string, out: string): string {
  const removed = multisetDiff(tokenize(raw), tokenize(out));
  const inserted = multisetDiff(tokenize(out), tokenize(raw));
  const parts: string[] = [];
  if (removed.length) parts.push(`  - removed: ${removed.join(", ")}`);
  if (inserted.length) parts.push(`  + inserted: ${inserted.join(", ")}`);
  return parts.join("\n");
}

function printCase(c: EvalCase | { id: string; raw: string }, r: CaseResult, verbose: boolean) {
  const mark = r.status === "pass" ? "✅" : r.status === "fallback" ? "🟡" : "❌";
  console.log(`${mark} ${r.id}${r.categories.length ? ` [${r.categories.join(",")}]` : ""}`);
  if (r.status !== "pass" || verbose) {
    console.log(`  in : ${c.raw.replaceAll("\n", "\\n")}`);
    console.log(`  out: ${r.output.replaceAll("\n", "\\n")}`);
    for (const v of r.violations) console.log(`  !! ${v}`);
    const diff = wordDiffSummary(c.raw, r.output);
    if (diff) console.log(diff);
  }
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture: Fixture = JSON.parse(readFileSync(args.fixture, "utf8"));
  const runtimeDir = join(args.modelsDir, "llama-server-runtime");
  const ctxSize = args.ctx ?? fixture.params.serverCtxSize;
  const ggufs =
    args.ggufs.length > 0 ? args.ggufs : [join(args.modelsDir, fixture.params.modelFilename)];

  const allSummaries: Record<string, unknown>[] = [];

  for (const gguf of ggufs) {
    let server: Server;
    if (args.port !== null && ggufs.length === 1) {
      server = { port: args.port, proc: null };
      console.log(`Reusing running server on port ${args.port}`);
    } else {
      if (!existsSync(gguf)) throw new Error(`GGUF not found: ${gguf}`);
      console.log(`\nStarting llama-server (${gguf.split("/").pop()}, ctx ${ctxSize})...`);
      server = await startServer(gguf, runtimeDir, ctxSize);
    }
    const kill = () => server.proc?.kill("SIGKILL");
    process.on("SIGINT", () => {
      kill();
      process.exit(130);
    });

    try {
      if (args.fromHistory !== null) {
        await runHistoryMode(fixture, server.port, args);
        continue;
      }

      const cases: EvalCase[] = readFileSync(args.suite, "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
        .filter((c: EvalCase) => !args.only || c.id.includes(args.only));

      console.log(`Running ${cases.length} cases...\n`);
      const results: CaseResult[] = [];
      const started = Date.now();
      for (const c of cases) {
        const t0 = Date.now();
        const pipelineResult = await runModel(fixture, server.port, c.raw, c.customWords ?? []);
        const r = checkCase(fixture, c, pipelineResult);
        results.push(r);
        printCase(c, r, args.verbose);
        if (args.verbose) console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }

      const total = results.length;
      const pass = results.filter((r) => r.status === "pass").length;
      const fallback = results.filter((r) => r.status === "fallback").length;
      const byCategory: Record<string, number> = {};
      for (const r of results) {
        for (const cat of r.categories) byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      }
      const byGroup: Record<string, { pass: number; total: number }> = {};
      for (const r of results) {
        byGroup[r.group] ??= { pass: 0, total: 0 };
        byGroup[r.group].total++;
        if (r.status === "pass") byGroup[r.group].pass++;
      }

      const modelName = gguf.split("/").pop();
      console.log(`\n===== ${modelName} =====`);
      console.log(`pass ${pass}/${total} (${((100 * pass) / total).toFixed(0)}%)  |  fallback-to-raw ${fallback}  |  elapsed ${((Date.now() - started) / 1000).toFixed(0)}s`);
      for (const [cat, n] of Object.entries(byCategory)) {
        console.log(`  ${cat}: ${n}`);
      }
      for (const [group, s] of Object.entries(byGroup)) {
        console.log(`  ${group}: ${s.pass}/${s.total}`);
      }
      allSummaries.push({ model: modelName, pass, total, fallback, byCategory, byGroup, results });
    } finally {
      kill();
    }
  }

  if (allSummaries.length > 1) {
    console.log(`\n===== A/B comparison =====`);
    for (const s of allSummaries) {
      console.log(`${s.model}: ${s.pass}/${s.total} pass, ${s.fallback} fallback`);
    }
  }
  if (args.json) {
    await Bun.write(args.json, JSON.stringify({ generatedAt: new Date().toISOString(), runs: allSummaries }, null, 2));
    console.log(`\nJSON report written to ${args.json}`);
  }
  const failed = allSummaries.reduce(
    (acc, s) => acc + ((s.total as number) - (s.pass as number)),
    0,
  );
  process.exit(Math.min(failed, 100));
}

/** Replay the newest N raw transcripts from the app's history database and
 * eyeball what the current prompt would do to them. Only the automated
 * weird-output checks apply (there are no expectations for free dictations). */
async function runHistoryMode(fixture: Fixture, port: number, args: Args) {
  const { Database } = await import("bun:sqlite");
  const dbPath = join(args.modelsDir, "..", "history.db");
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .query(
      "SELECT id, transcription_text FROM transcription_history WHERE length(trim(transcription_text)) > 0 ORDER BY id DESC LIMIT ?",
    )
    .all(args.fromHistory) as { id: number; transcription_text: string }[];
  console.log(`Replaying ${rows.length} dictations from history.db...\n`);
  for (const row of rows.reverse()) {
    const c: EvalCase = { id: `history-${row.id}`, group: "history", lang: "nl", raw: row.transcription_text };
    const pipelineResult = await runModel(fixture, port, c.raw, []);
    const r = checkCase(fixture, c, pipelineResult);
    printCase(c, r, true);
    console.log("");
  }
  db.close();
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(101);
});
