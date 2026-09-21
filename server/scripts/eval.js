/**
 * eval.js — Lightweight evaluation script for the AI Research Agent
 *
 * Runs predefined research questions against the running server and measures:
 *   - Latency (ms)
 *   - Citation correctness (valid [N] refs vs total)
 *   - Unsupported / contradicted claims (from fact-check step)
 *   - Failures (HTTP errors / timeouts)
 *
 * Usage:
 *   node scripts/eval.js
 *   node scripts/eval.js --url http://localhost:3001   (custom server URL)
 *   node scripts/eval.js --json                        (also write results to eval-results.json)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SERVER_URL = (() => {
  const idx = args.indexOf('--url');
  return idx !== -1 ? args[idx + 1] : 'http://localhost:3001';
})();
const WRITE_JSON = args.includes('--json');
const TIMEOUT_MS = 120_000; // 2 minutes per question

// ── Predefined evaluation questions ──────────────────────────────────────────

const QUESTIONS = [
  'What are the current techniques used to reduce LLM hallucinations?',
  'How does retrieval-augmented generation (RAG) improve AI accuracy?',
  'What are the main differences between transformer and diffusion models?',
  'What ethical challenges exist in deploying large language models?',
  'How is reinforcement learning from human feedback (RLHF) used to align AI?',
];

// ── HTTP helper ───────────────────────────────────────────────────────────────

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Metrics helpers ───────────────────────────────────────────────────────────

/**
 * Count [N] citation markers in the report and check how many are valid.
 * Returns { total, valid, invalid, accuracy }
 */
function measureCitations(report, sourceCount) {
  const matches = [...report.matchAll(/\[(\d+)\]/g)];
  if (matches.length === 0) return { total: 0, valid: 0, invalid: 0, accuracy: null };

  let valid = 0;
  let invalid = 0;
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= sourceCount) valid++;
    else invalid++;
  }
  return {
    total: matches.length,
    valid,
    invalid,
    accuracy: ((valid / matches.length) * 100).toFixed(1) + '%',
  };
}

/**
 * Summarise fact-check results: count by status.
 */
function measureFactCheck(factCheck) {
  if (!factCheck || factCheck.length === 0) {
    return { total: 0, supported: 0, contradicted: 0, unverified: 0 };
  }
  const counts = { total: factCheck.length, supported: 0, contradicted: 0, unverified: 0 };
  for (const item of factCheck) counts[item.status]++;
  return counts;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

function pad(str, len) {
  str = String(str ?? '');
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function colorStatus(ok, warn, fail, value) {
  if (fail) return RED + value + RESET;
  if (warn) return YELLOW + value + RESET;
  return GREEN + value + RESET;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${CYAN}AI Research Agent — Evaluation Run${RESET}`);
  console.log(`${DIM}Server: ${SERVER_URL}${RESET}`);
  console.log(`${DIM}Questions: ${QUESTIONS.length}${RESET}\n`);

  const results = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const question = QUESTIONS[i];
    const label = `[${i + 1}/${QUESTIONS.length}]`;
    process.stdout.write(`${BOLD}${label}${RESET} ${question.slice(0, 60)}...  `);

    const start = Date.now();
    let row;

    try {
      const data = await postJSON(`${SERVER_URL}/api/research`, { question });
      const latency = Date.now() - start;

      const citations = measureCitations(data.report ?? '', (data.sources ?? []).length);
      const fc = measureFactCheck(data.factCheck);

      row = {
        question: question.slice(0, 55) + '…',
        status: 'ok',
        latencyMs: latency,
        sources: (data.sources ?? []).length,
        citationAccuracy: citations.accuracy ?? 'n/a',
        citationInvalid: citations.invalid,
        fcSupported: fc.supported,
        fcContradicted: fc.contradicted,
        fcUnverified: fc.unverified,
        fcTotal: fc.total,
        error: null,
      };

      const warn = citations.invalid > 0 || fc.contradicted > 0;
      const statusStr = warn ? `${YELLOW}WARN${RESET}` : `${GREEN}OK${RESET}`;
      console.log(`${statusStr}  ${latency}ms`);
    } catch (err) {
      const latency = Date.now() - start;
      row = {
        question: question.slice(0, 55) + '…',
        status: 'fail',
        latencyMs: latency,
        sources: 0,
        citationAccuracy: 'n/a',
        citationInvalid: 0,
        fcSupported: 0,
        fcContradicted: 0,
        fcUnverified: 0,
        fcTotal: 0,
        error: err.message,
      };
      console.log(`${RED}FAIL${RESET}  ${err.message.slice(0, 60)}`);
    }

    results.push(row);
  }

  // ── Summary table ───────────────────────────────────────────────────────────

  console.log(`\n${BOLD}${'─'.repeat(100)}${RESET}`);
  console.log(
    `${BOLD}${pad('#', 3)} ${pad('Question', 56)} ${pad('Status', 7)} ${pad('ms', 7)} ${pad('Src', 4)} ${pad('Cite%', 7)} ${pad('Inv', 4)} ${pad('Sup', 4)} ${pad('Con', 4)} ${pad('Unv', 4)}${RESET}`
  );
  console.log('─'.repeat(100));

  const latencies = [];
  let totalFails = 0;
  let totalInvalid = 0;
  let totalCitations = 0;

  results.forEach((r, i) => {
    const isFail = r.status === 'fail';
    const isWarn = r.citationInvalid > 0 || r.fcContradicted > 0;

    const statusCol = isFail
      ? RED + pad('FAIL', 7) + RESET
      : isWarn
      ? YELLOW + pad('WARN', 7) + RESET
      : GREEN + pad('OK', 7) + RESET;

    console.log(
      `${pad(i + 1, 3)} ${DIM}${pad(r.question, 56)}${RESET} ${statusCol} ${pad(r.latencyMs, 7)} ${pad(r.sources, 4)} ${pad(r.citationAccuracy, 7)} ${isFail ? pad('-', 4) : colorStatus(r.citationInvalid === 0, false, r.citationInvalid > 2, r.citationInvalid)} ${isFail ? pad('-', 4) : GREEN + pad(r.fcSupported, 4) + RESET} ${isFail ? pad('-', 4) : colorStatus(r.fcContradicted === 0, r.fcContradicted > 0, false, r.fcContradicted)} ${isFail ? pad('-', 4) : YELLOW + pad(r.fcUnverified, 4) + RESET}`
    );

    if (!isFail) latencies.push(r.latencyMs);
    if (isFail) totalFails++;
    totalInvalid += r.citationInvalid;
  });

  console.log('─'.repeat(100));

  // ── Aggregate stats ─────────────────────────────────────────────────────────

  const successful = results.filter((r) => r.status === 'ok');
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 'n/a';
  const minLatency = latencies.length ? Math.min(...latencies) : 'n/a';
  const maxLatency = latencies.length ? Math.max(...latencies) : 'n/a';
  const totalCitationInvalid = successful.reduce((a, r) => a + r.citationInvalid, 0);
  const totalFcContradicted = successful.reduce((a, r) => a + r.fcContradicted, 0);
  const totalFcUnverified = successful.reduce((a, r) => a + r.fcUnverified, 0);

  console.log(`\n${BOLD}Summary${RESET}`);
  console.log(`  Runs:              ${QUESTIONS.length}`);
  console.log(`  Successful:        ${GREEN}${successful.length}${RESET}  |  Failures: ${totalFails > 0 ? RED + totalFails + RESET : GREEN + '0' + RESET}`);
  console.log(`  Latency (avg):     ${avgLatency}ms  |  min: ${minLatency}ms  |  max: ${maxLatency}ms`);
  console.log(`  Invalid citations: ${totalCitationInvalid > 0 ? RED + totalCitationInvalid + RESET : GREEN + '0' + RESET}`);
  console.log(`  Contradicted claims: ${totalFcContradicted > 0 ? YELLOW + totalFcContradicted + RESET : GREEN + '0' + RESET}`);
  console.log(`  Unverified claims:   ${YELLOW}${totalFcUnverified}${RESET}`);

  // Legend
  console.log(`\n${DIM}Columns: # | Question | Status | Latency(ms) | Sources | Citation% | InvalidCitations | Supported | Contradicted | Unverified${RESET}\n`);

  // ── JSON output (optional) ──────────────────────────────────────────────────

  if (WRITE_JSON) {
    const outPath = path.join(__dirname, '..', 'eval-results.json');
    const output = {
      timestamp: new Date().toISOString(),
      server: SERVER_URL,
      summary: {
        total: QUESTIONS.length,
        successful: successful.length,
        failures: totalFails,
        avgLatencyMs: avgLatency,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        totalInvalidCitations: totalCitationInvalid,
        totalContradictedClaims: totalFcContradicted,
        totalUnverifiedClaims: totalFcUnverified,
      },
      results,
    };
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`${GREEN}✓${RESET} Results written to ${outPath}\n`);
  }

  process.exit(totalFails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error:${RESET}`, err.message);
  process.exit(1);
});
