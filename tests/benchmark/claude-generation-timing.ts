/**
 * Claude Generation Timing Benchmark
 *
 * Measures how long it takes Claude to generate equivalent ask/draw commands
 * in JSON vs DSL format. This tests REAL LLM generation time.
 *
 * Usage: npx tsx tests/benchmark/claude-generation-timing.ts
 *
 * Requires: `claude` CLI to be available (Claude Code)
 */

import { execSync, exec } from "child_process";

// ── Helpers ──────────────────────────────────────────────────────

function runClaude(prompt: string): Promise<{ output: string; ms: number; outputChars: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    exec(
      `claude -p --output-format text "${prompt.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", timeout: 120000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const ms = performance.now() - start;
        if (err && !stdout) {
          reject(new Error(`Claude failed: ${stderr || err.message}`));
          return;
        }
        resolve({ output: stdout.trim(), ms, outputChars: stdout.trim().length });
      }
    );
  });
}

function extractCommandBlock(output: string): string {
  // Extract the actual command from Claude's output (between ``` blocks or the raw command)
  const codeBlockMatch = output.match(/```(?:bash|shell|sh)?\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find claude-canvas command directly
  const cmdMatch = output.match(/(claude-canvas\s+(?:ask|draw)\s+[\s\S]*)/);
  if (cmdMatch) return cmdMatch[1].trim();

  return output;
}

function countCoordinateValues(text: string): number {
  // Count explicit x, y, x1, y1, x2, y2, width, height, radius numeric values
  const matches = text.match(/"(?:x|y|x1|y1|x2|y2|width|height|radius)":\s*\d+/g);
  return matches ? matches.length : 0;
}

// ── Test Scenarios ──────────────────────────────────────────────

interface TestScenario {
  name: string;
  description: string;
  jsonPrompt: string;
  dslPrompt: string;
}

const scenarios: TestScenario[] = [
  {
    name: "Dashboard Layout Comparison",
    description: "Complex ask with 2 layout options, nested wireframes",
    jsonPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas ask command (no explanation, no markdown) that asks the user to choose between 2 dashboard layouts.

Question: "Which dashboard layout do you prefer?" with options "Sidebar Navigation" and "Top Navigation".

Layout A (Sidebar): An app shell containing a sidebar (80px wide, solid fill, blue #7198C9) on the left and a content area on the right with a header bar on top, a row of 2 widget boxes below it, and a table at the bottom.

Layout B (Top Nav): An app shell containing a top navigation bar (full width, solid fill, green #8AAD5A) at the top, and below it a filters panel on the left and content area on the right with 2 widget boxes and a table.

Output ONLY the raw command, using JSON format:
claude-canvas ask '{"questions": [{"id": "q1", "text": "...", "type": "single", "options": [...], "commands": [...]}]}'

Every shape needs explicit x, y, width, height coordinates. Place Layout A on the left side and Layout B on the right with spacing between them. Canvas is 1200x800.`,

    dslPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas ask command (no explanation, no markdown) that asks the user to choose between 2 dashboard layouts.

Question: "Which dashboard layout do you prefer?" with options "Sidebar Navigation" and "Top Navigation".

Layout A (Sidebar): An app shell containing a sidebar (80px wide, solid fill, blue #7198C9) on the left and a content area on the right with a header bar on top, a row of 2 widget boxes below it, and a table at the bottom.

Layout B (Top Nav): An app shell containing a top navigation bar (full width, solid fill, green #8AAD5A) at the top, and below it a filters panel on the left and content area on the right with 2 widget boxes and a table.

Output ONLY the raw command, using the DSL format with --dsl flag:
claude-canvas ask --dsl 'ask { question #id type "text" { options "A" | "B"; row/stack layout... } }'

DSL rules: Use row{} for horizontal, stack{} for vertical, box "label" WIDTHxHEIGHT for shapes, pad=N for container padding, gap=N for spacing, fill=solid/none, color=#HEX. NO coordinates needed - the layout engine computes them automatically.`,
  },
  {
    name: "Architecture Diagram with Data Flow",
    description: "Draw command with 5 services, arrows showing data flow",
    jsonPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas draw command (no explanation, no markdown) that draws a microservices architecture diagram.

Draw these 5 services in a horizontal row with spacing: "API Gateway", "Auth Service", "User Service", "Order Service", "Database". Each should be a colored box (200x100). Use different colors for each. Add arrows between them showing the data flow: API Gateway -> Auth Service, API Gateway -> User Service, API Gateway -> Order Service, User Service -> Database, Order Service -> Database.

Output ONLY the raw command using JSON format:
claude-canvas draw '{"commands": [...]}'

Every shape needs explicit x, y, width, height and every arrow needs x1, y1, x2, y2 coordinates.`,

    dslPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas draw command (no explanation, no markdown) that draws a microservices architecture diagram.

Draw these 5 services in a horizontal row with spacing: "API Gateway", "Auth Service", "User Service", "Order Service", "Database". Each should be a colored box (200x100). Use different colors for each. Add arrows between them showing the data flow: API Gateway -> Auth Service, API Gateway -> User Service, API Gateway -> Order Service, User Service -> Database, Order Service -> Database.

Output ONLY the raw command using the DSL format with --dsl flag:
claude-canvas draw --dsl 'row gap=30 { box "label" WIDTHxHEIGHT color=#HEX; ... }; arrow "from" -> "to" "label"'

DSL rules: Use row{} for horizontal layout, box "label" WIDTHxHEIGHT for shapes, gap=N for spacing, fill=solid/none, color=#HEX, arrow "Label A" -> "Label B" "description" for label-based arrows. NO coordinates needed.`,
  },
  {
    name: "Multi-Question Visual Q&A",
    description: "3 questions: layout choice, widget spacing, and free text",
    jsonPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas ask command (no explanation, no markdown) with 3 questions:

Q1 (single choice): "Which card style?" with options "Rounded" and "Sharp". Draw 2 example cards side by side - one with rounded appearance (use hachure fill) and one with sharp appearance (use solid fill). Each card should contain a title text and a content area.

Q2 (single choice): "How many columns?" with options "2 columns", "3 columns", "4 columns". Draw 3 grid examples showing 2, 3, and 4 equal-width columns of boxes arranged side by side.

Q3 (text): "Any additional design requirements?"

Output ONLY the raw command using JSON format:
claude-canvas ask '{"questions": [...]}'

Every shape needs explicit x, y, width, height coordinates. Arrange visuals clearly for each question.`,

    dslPrompt: `You are a canvas drawing tool. Generate ONLY a claude-canvas ask command (no explanation, no markdown) with 3 questions:

Q1 (single choice): "Which card style?" with options "Rounded" and "Sharp". Draw 2 example cards side by side - one with rounded appearance (use hachure fill) and one with sharp appearance (use solid fill). Each card should contain a title text and a content area.

Q2 (single choice): "How many columns?" with options "2 columns", "3 columns", "4 columns". Draw 3 grid examples showing 2, 3, and 4 equal-width columns of boxes arranged side by side.

Q3 (text): "Any additional design requirements?"

Output ONLY the raw command using the DSL format with --dsl flag:
claude-canvas ask --dsl 'ask { question #id type "text" { options "A" | "B"; layout... } }'

DSL rules: Use row{} for horizontal, stack{} for vertical, box "label" WIDTHxHEIGHT, pad=N, gap=N, fill=solid/hachure/none, color=#HEX, text "content" size=N. NO coordinates needed.`,
  },
];

// ── Benchmark Runner ──────────────────────────────────────────

async function runBenchmark() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║       Claude Generation Timing: JSON vs DSL                      ║");
  console.log("║       Real LLM output measurement                                ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Each scenario runs Claude twice: once for JSON, once for DSL.");
  console.log("Measuring: generation time, output size, coordinate count.");
  console.log("");

  const results: Array<{
    scenario: string;
    jsonMs: number;
    dslMs: number;
    jsonChars: number;
    dslChars: number;
    jsonCoords: number;
    timeSaved: string;
    charsSaved: string;
  }> = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`━━━ Scenario ${i + 1}/${scenarios.length}: ${scenario.name} ━━━`);
    console.log(`    ${scenario.description}`);
    console.log("");

    // Run JSON version
    console.log("  Generating JSON version...");
    let jsonResult: { output: string; ms: number; outputChars: number };
    try {
      jsonResult = await runClaude(scenario.jsonPrompt);
      console.log(`    Done in ${(jsonResult.ms / 1000).toFixed(2)}s (${jsonResult.outputChars} chars)`);
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      continue;
    }

    // Small pause between calls
    await new Promise((r) => setTimeout(r, 2000));

    // Run DSL version
    console.log("  Generating DSL version...");
    let dslResult: { output: string; ms: number; outputChars: number };
    try {
      dslResult = await runClaude(scenario.dslPrompt);
      console.log(`    Done in ${(dslResult.ms / 1000).toFixed(2)}s (${dslResult.outputChars} chars)`);
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      continue;
    }

    const jsonCmd = extractCommandBlock(jsonResult.output);
    const dslCmd = extractCommandBlock(dslResult.output);
    const jsonCoords = countCoordinateValues(jsonCmd);

    const timeDiff = jsonResult.ms - dslResult.ms;
    const timePct = ((timeDiff / jsonResult.ms) * 100).toFixed(1);
    const charDiff = jsonResult.outputChars - dslResult.outputChars;
    const charPct = ((charDiff / jsonResult.outputChars) * 100).toFixed(1);

    results.push({
      scenario: scenario.name,
      jsonMs: Math.round(jsonResult.ms),
      dslMs: Math.round(dslResult.ms),
      jsonChars: jsonResult.outputChars,
      dslChars: dslResult.outputChars,
      jsonCoords,
      timeSaved: `${(timeDiff / 1000).toFixed(2)}s (${timePct}%)`,
      charsSaved: `${charDiff} chars (${charPct}%)`,
    });

    console.log("");
    console.log(`  ┌────────────────────────────────────────┐`);
    console.log(`  │ JSON: ${(jsonResult.ms / 1000).toFixed(2)}s, ${jsonResult.outputChars} chars, ${jsonCoords} coord values`);
    console.log(`  │ DSL:  ${(dslResult.ms / 1000).toFixed(2)}s, ${dslResult.outputChars} chars, 0 coord values`);
    console.log(`  │ Time saved: ${(timeDiff / 1000).toFixed(2)}s (${timePct}%)`);
    console.log(`  │ Output saved: ${charDiff} chars (${charPct}%)`);
    console.log(`  └────────────────────────────────────────┘`);
    console.log("");

    // Pause between scenarios
    if (i < scenarios.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // ── Final Report ──────────────────────────────────────────

  if (results.length === 0) {
    console.error("No scenarios completed successfully.");
    process.exit(1);
  }

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    FINAL REPORT                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log("");

  // Detailed table
  console.log("┌──────────────────────────┬────────────┬────────────┬────────────┐");
  console.log("│ Scenario                 │ JSON Time  │ DSL Time   │ Time Saved │");
  console.log("├──────────────────────────┼────────────┼────────────┼────────────┤");
  for (const r of results) {
    const name = r.scenario.substring(0, 24).padEnd(24);
    const jt = ((r.jsonMs / 1000).toFixed(2) + "s").padStart(8);
    const dt = ((r.dslMs / 1000).toFixed(2) + "s").padStart(8);
    const diff = (((r.jsonMs - r.dslMs) / 1000).toFixed(2) + "s").padStart(8);
    console.log(`│ ${name} │   ${jt} │   ${dt} │   ${diff} │`);
  }
  console.log("└──────────────────────────┴────────────┴────────────┴────────────┘");
  console.log("");

  console.log("┌──────────────────────────┬────────────┬────────────┬────────────┐");
  console.log("│ Scenario                 │ JSON Chars │ DSL Chars  │ Reduction  │");
  console.log("├──────────────────────────┼────────────┼────────────┼────────────┤");
  for (const r of results) {
    const name = r.scenario.substring(0, 24).padEnd(24);
    const jc = String(r.jsonChars).padStart(8);
    const dc = String(r.dslChars).padStart(8);
    const pct = (((r.jsonChars - r.dslChars) / r.jsonChars) * 100).toFixed(1) + "%";
    console.log(`│ ${name} │   ${jc} │   ${dc} │   ${pct.padStart(7)} │`);
  }
  console.log("└──────────────────────────┴────────────┴────────────┴────────────┘");
  console.log("");

  // Aggregates
  const totalJsonMs = results.reduce((s, r) => s + r.jsonMs, 0);
  const totalDslMs = results.reduce((s, r) => s + r.dslMs, 0);
  const totalJsonChars = results.reduce((s, r) => s + r.jsonChars, 0);
  const totalDslChars = results.reduce((s, r) => s + r.dslChars, 0);
  const totalCoords = results.reduce((s, r) => s + r.jsonCoords, 0);
  const avgJsonMs = totalJsonMs / results.length;
  const avgDslMs = totalDslMs / results.length;

  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ AGGREGATE RESULTS                                               │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│ Total JSON generation time:      ${(totalJsonMs / 1000).toFixed(2).padStart(8)}s                       │`);
  console.log(`│ Total DSL generation time:       ${(totalDslMs / 1000).toFixed(2).padStart(8)}s                       │`);
  console.log(`│ Total time saved:                ${((totalJsonMs - totalDslMs) / 1000).toFixed(2).padStart(8)}s (${((1 - totalDslMs / totalJsonMs) * 100).toFixed(1)}%)              │`);
  console.log(`│                                                                 │`);
  console.log(`│ Avg JSON generation time:        ${(avgJsonMs / 1000).toFixed(2).padStart(8)}s                       │`);
  console.log(`│ Avg DSL generation time:         ${(avgDslMs / 1000).toFixed(2).padStart(8)}s                       │`);
  console.log(`│ Avg time saved per command:      ${(((avgJsonMs - avgDslMs)) / 1000).toFixed(2).padStart(8)}s                       │`);
  console.log(`│                                                                 │`);
  console.log(`│ Total JSON output:               ${String(totalJsonChars).padStart(8)} chars                  │`);
  console.log(`│ Total DSL output:                ${String(totalDslChars).padStart(8)} chars                  │`);
  console.log(`│ Output reduction:                ${((1 - totalDslChars / totalJsonChars) * 100).toFixed(1).padStart(7)}%                       │`);
  console.log(`│                                                                 │`);
  console.log(`│ Coordinate values eliminated:    ${String(totalCoords).padStart(8)}                       │`);
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log("");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
