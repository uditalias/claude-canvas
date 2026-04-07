/**
 * DSL vs JSON Benchmark
 *
 * Compares token count, character count, parse time, and round-trip time
 * for equivalent draw/ask payloads in JSON and DSL formats.
 *
 * Usage: npx tsx tests/benchmark/dsl-vs-json.ts
 */

import * as http from "http";
import { execSync } from "child_process";
import { parseDSL } from "../../src/bin/dsl/index.js";

// ── Helpers ──────────────────────────────────────────────────────

function httpPost(url: string, body: unknown): Promise<{ result: unknown; ms: number }> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let resp = "";
        res.on("data", (chunk) => (resp += chunk));
        res.on("end", () => {
          const ms = performance.now() - start;
          try {
            resolve({ result: JSON.parse(resp), ms });
          } catch {
            reject(new Error(`Invalid response: ${resp}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function estimateTokens(str: string): number {
  // GPT/Claude tokenizer rough estimate: ~4 chars per token for code/JSON, ~3.5 for natural text
  // JSON has lots of punctuation (quotes, colons, brackets) = more tokens per char
  // DSL is more natural = fewer tokens per char
  return Math.ceil(str.length / 3.8);
}

function startSession(port: number): string {
  const result = execSync(`npx tsx src/bin/claude-canvas.ts start -p ${port}`, {
    encoding: "utf-8",
    timeout: 15000,
    env: { ...process.env },
  });
  const parsed = JSON.parse(result.trim());
  return parsed.sessionId;
}

function stopSession(sessionId: string): void {
  try {
    execSync(`npx tsx src/bin/claude-canvas.ts stop -s ${sessionId}`, {
      encoding: "utf-8",
      timeout: 10000,
    });
  } catch {
    // ignore
  }
}

async function waitForServer(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Server on port ${port} not ready after ${timeoutMs}ms`);
}

// ── Benchmark Scenarios ──────────────────────────────────────────

interface Scenario {
  name: string;
  dsl: string;
  json: string;
}

const scenarios: Scenario[] = [
  // ── Scenario 1: Simple architecture diagram ──
  {
    name: "Simple Architecture Diagram (3 boxes + 2 arrows)",
    dsl: `row gap=60 {
  box "Frontend" 180x100 fill=solid color=#7198C9
  box "Backend API" 180x100 fill=hachure color=#8AAD5A
  box "Database" 180x100 fill=solid color=#D9925E
}
arrow "Frontend" -> "Backend API" "REST"
arrow "Backend API" -> "Database" "SQL"`,
    json: JSON.stringify({
      commands: [
        { type: "rect", x: 50, y: 50, width: 180, height: 100, label: "Frontend", fillStyle: "solid", color: "#7198C9" },
        { type: "rect", x: 290, y: 50, width: 180, height: 100, label: "Backend API", fillStyle: "hachure", color: "#8AAD5A" },
        { type: "rect", x: 530, y: 50, width: 180, height: 100, label: "Database", fillStyle: "solid", color: "#D9925E" },
        { type: "arrow", x1: 230, y1: 100, x2: 290, y2: 100, label: "REST" },
        { type: "arrow", x1: 470, y1: 100, x2: 530, y2: 100, label: "SQL" },
      ],
    }),
  },

  // ── Scenario 2: Dashboard wireframe comparison ──
  {
    name: "Dashboard Layout Comparison (2 side-by-side wireframes)",
    dsl: `row gap=60 {
  stack gap=10 {
    text "Layout A - Sidebar Nav" size=18
    box "App Shell" pad=10 {
      row gap=10 {
        box "Sidebar" 80x220 fill=solid color=#7198C9
        stack gap=10 {
          box "Header" 250x40 fill=none
          row gap=10 {
            box "Chart" 120x100 fill=none
            box "Stats" 120x100 fill=none
          }
          box "Table" 250x80 fill=none
        }
      }
    }
  }
  stack gap=10 {
    text "Layout B - Top Nav" size=18
    box "App Shell" pad=10 {
      stack gap=10 {
        box "Top Nav" 340x40 fill=solid color=#8AAD5A
        row gap=10 {
          box "Filters" 100x190 fill=none
          stack gap=10 {
            row gap=10 {
              box "Chart" 110x85 fill=none
              box "Stats" 110x85 fill=none
            }
            box "Table" 230x95 fill=none
          }
        }
      }
    }
  }
}`,
    json: JSON.stringify({
      commands: [
        { type: "text", x: 220, y: 30, content: "Layout A - Sidebar Nav", fontSize: 18, textAlign: "center" },
        { type: "rect", x: 50, y: 55, width: 360, height: 260, label: "App Shell" },
        { type: "rect", x: 60, y: 65, width: 80, height: 220, label: "Sidebar", fillStyle: "solid", color: "#7198C9" },
        { type: "rect", x: 150, y: 65, width: 250, height: 40, label: "Header", fillStyle: "none" },
        { type: "rect", x: 150, y: 115, width: 120, height: 100, label: "Chart", fillStyle: "none" },
        { type: "rect", x: 280, y: 115, width: 120, height: 100, label: "Stats", fillStyle: "none" },
        { type: "rect", x: 150, y: 225, width: 250, height: 80, label: "Table", fillStyle: "none" },
        { type: "text", x: 640, y: 30, content: "Layout B - Top Nav", fontSize: 18, textAlign: "center" },
        { type: "rect", x: 430, y: 55, width: 380, height: 260, label: "App Shell" },
        { type: "rect", x: 440, y: 65, width: 340, height: 40, label: "Top Nav", fillStyle: "solid", color: "#8AAD5A" },
        { type: "rect", x: 440, y: 115, width: 100, height: 190, label: "Filters", fillStyle: "none" },
        { type: "rect", x: 550, y: 115, width: 110, height: 85, label: "Chart", fillStyle: "none" },
        { type: "rect", x: 670, y: 115, width: 110, height: 85, label: "Stats", fillStyle: "none" },
        { type: "rect", x: 550, y: 210, width: 230, height: 95, label: "Table", fillStyle: "none" },
      ],
    }),
  },

  // ── Scenario 3: Flowchart with groups & connectors ──
  {
    name: "Flowchart (5 groups + 4 connectors)",
    dsl: `stack gap=40 {
  group #start {
    box "Start" 160x60 fill=solid color=#8AAD5A
  }
  group #validate {
    box "Validate Input" 160x60
  }
  group #process {
    box "Process Data" 160x60
  }
  group #save {
    box "Save to DB" 160x60
  }
  group #done {
    box "Done" 160x60 fill=solid color=#7198C9
  }
}
connector #start -> #validate
connector #validate -> #process "if valid"
connector #process -> #save
connector #save -> #done`,
    json: JSON.stringify({
      commands: [
        { type: "group", id: "start", commands: [
          { type: "rect", x: 200, y: 30, width: 160, height: 60, fillStyle: "solid", color: "#8AAD5A" },
          { type: "text", x: 280, y: 50, content: "Start", textAlign: "center" },
        ]},
        { type: "group", id: "validate", commands: [
          { type: "rect", x: 200, y: 130, width: 160, height: 60 },
          { type: "text", x: 280, y: 150, content: "Validate Input", textAlign: "center" },
        ]},
        { type: "group", id: "process", commands: [
          { type: "rect", x: 200, y: 230, width: 160, height: 60 },
          { type: "text", x: 280, y: 250, content: "Process Data", textAlign: "center" },
        ]},
        { type: "group", id: "save", commands: [
          { type: "rect", x: 200, y: 330, width: 160, height: 60 },
          { type: "text", x: 280, y: 350, content: "Save to DB", textAlign: "center" },
        ]},
        { type: "group", id: "done", commands: [
          { type: "rect", x: 200, y: 430, width: 160, height: 60, fillStyle: "solid", color: "#7198C9" },
          { type: "text", x: 280, y: 450, content: "Done", textAlign: "center" },
        ]},
        { type: "connector", from: "start", to: "validate" },
        { type: "connector", from: "validate", to: "process", label: "if valid" },
        { type: "connector", from: "process", to: "save" },
        { type: "connector", from: "save", to: "done" },
      ],
    }),
  },

  // ── Scenario 4: Multi-question visual Q&A ──
  {
    name: "Visual Q&A (3 questions with graphics)",
    dsl: `ask {
  question #q1 single "Which dashboard layout do you prefer?" {
    options "Sidebar Navigation" | "Top Navigation"
    row gap=40 {
      box "Sidebar Nav" pad=8 {
        row gap=8 {
          box "Side" 60x150 fill=solid color=#7198C9
          stack gap=8 {
            box "Header" 180x30 fill=none
            box "Content" 180x112 fill=none
          }
        }
      }
      box "Top Nav" pad=8 {
        stack gap=8 {
          box "Nav Bar" 250x30 fill=solid color=#8AAD5A
          box "Content" 250x112 fill=none
        }
      }
    }
  }
  question #q2 single "How should widgets be spaced?" {
    options "Compact (8px)" | "Comfortable (16px)" | "Spacious (24px)"
    row gap=30 {
      stack gap=5 {
        text "Compact" size=14
        box "Grid" pad=8 {
          row gap=8 {
            stack gap=8 { box 80x80; box 80x80 }
            stack gap=8 { box 80x80; box 80x80 }
          }
        }
      }
      stack gap=5 {
        text "Comfortable" size=14
        box "Grid" pad=16 {
          row gap=16 {
            stack gap=16 { box 70x70; box 70x70 }
            stack gap=16 { box 70x70; box 70x70 }
          }
        }
      }
      stack gap=5 {
        text "Spacious" size=14
        box "Grid" pad=24 {
          row gap=24 {
            stack gap=24 { box 60x60; box 60x60 }
            stack gap=24 { box 60x60; box 60x60 }
          }
        }
      }
    }
  }
  question #q3 text "Any other notes on the layout?"
}`,
    json: JSON.stringify({
      questions: [
        {
          id: "q1",
          text: "Which dashboard layout do you prefer?",
          type: "single",
          options: ["Sidebar Navigation", "Top Navigation"],
          commands: [
            { type: "rect", x: 50, y: 50, width: 266, height: 182, label: "Sidebar Nav" },
            { type: "rect", x: 58, y: 58, width: 60, height: 150, fillStyle: "solid", color: "#7198C9", label: "Side" },
            { type: "rect", x: 126, y: 58, width: 180, height: 30, fillStyle: "none", label: "Header" },
            { type: "rect", x: 126, y: 96, width: 180, height: 112, fillStyle: "none", label: "Content" },
            { type: "rect", x: 356, y: 50, width: 282, height: 168, label: "Top Nav" },
            { type: "rect", x: 364, y: 58, width: 250, height: 30, fillStyle: "solid", color: "#8AAD5A", label: "Nav Bar" },
            { type: "rect", x: 364, y: 96, width: 250, height: 112, fillStyle: "none", label: "Content" },
          ],
        },
        {
          id: "q2",
          text: "How should widgets be spaced?",
          type: "single",
          options: ["Compact (8px)", "Comfortable (16px)", "Spacious (24px)"],
          commands: [
            { type: "text", x: 148, y: 50, content: "Compact", fontSize: 14, textAlign: "center" },
            { type: "rect", x: 50, y: 70, width: 184, height: 184, label: "Grid" },
            { type: "rect", x: 58, y: 78, width: 80, height: 80 },
            { type: "rect", x: 146, y: 78, width: 80, height: 80 },
            { type: "rect", x: 58, y: 166, width: 80, height: 80 },
            { type: "rect", x: 146, y: 166, width: 80, height: 80 },
            { type: "text", x: 391, y: 50, content: "Comfortable", fontSize: 14, textAlign: "center" },
            { type: "rect", x: 264, y: 70, width: 204, height: 204, label: "Grid" },
            { type: "rect", x: 280, y: 86, width: 70, height: 70 },
            { type: "rect", x: 366, y: 86, width: 70, height: 70 },
            { type: "rect", x: 280, y: 172, width: 70, height: 70 },
            { type: "rect", x: 366, y: 172, width: 70, height: 70 },
            { type: "text", x: 638, y: 50, content: "Spacious", fontSize: 14, textAlign: "center" },
            { type: "rect", x: 498, y: 70, width: 216, height: 216, label: "Grid" },
            { type: "rect", x: 522, y: 94, width: 60, height: 60 },
            { type: "rect", x: 606, y: 94, width: 60, height: 60 },
            { type: "rect", x: 522, y: 178, width: 60, height: 60 },
            { type: "rect", x: 606, y: 178, width: 60, height: 60 },
          ],
        },
        {
          id: "q3",
          text: "Any other notes on the layout?",
          type: "text",
        },
      ],
    }),
  },
];

// ── Benchmark Runner ──────────────────────────────────────────────

async function runBenchmark() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           DSL vs JSON Benchmark Report                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Start two sessions
  console.log("Starting canvas sessions...");
  let jsonSessionId: string;
  let dslSessionId: string;
  const jsonPort = 7891;
  const dslPort = 7892;

  try {
    jsonSessionId = startSession(jsonPort);
    console.log(`  JSON session: ${jsonSessionId} on port ${jsonPort}`);
  } catch (e) {
    console.error("Failed to start JSON session:", (e as Error).message);
    process.exit(1);
  }

  try {
    dslSessionId = startSession(dslPort);
    console.log(`  DSL session:  ${dslSessionId} on port ${dslPort}`);
  } catch (e) {
    stopSession(jsonSessionId!);
    console.error("Failed to start DSL session:", (e as Error).message);
    process.exit(1);
  }

  // Wait for servers
  console.log("Waiting for servers...");
  await waitForServer(jsonPort);
  await waitForServer(dslPort);
  console.log("  Both servers ready.\n");

  // Wait a bit for browser WS connections
  await new Promise((r) => setTimeout(r, 2000));

  const results: Array<{
    scenario: string;
    jsonChars: number;
    dslChars: number;
    jsonTokensEst: number;
    dslTokensEst: number;
    charReduction: string;
    tokenReduction: string;
    jsonParseMs: number;
    dslParseMs: number;
    jsonRoundtripMs: number;
    dslRoundtripMs: number;
    coordValues: number;
  }> = [];

  for (const scenario of scenarios) {
    console.log(`━━━ ${scenario.name} ━━━`);

    // Measure input sizes
    const jsonChars = scenario.json.length;
    const dslChars = scenario.dsl.length;
    const jsonTokensEst = estimateTokens(scenario.json);
    const dslTokensEst = estimateTokens(scenario.dsl);

    // Count coordinate values in JSON (x, y, x1, y1, x2, y2, width, height, radius values)
    const coordMatches = scenario.json.match(/"(x|y|x1|y1|x2|y2|width|height|radius)":\s*\d+/g);
    const coordValues = coordMatches ? coordMatches.length : 0;

    // Measure parse time — JSON
    const jsonParseStart = performance.now();
    for (let i = 0; i < 100; i++) JSON.parse(scenario.json);
    const jsonParseMs = (performance.now() - jsonParseStart) / 100;

    // Measure parse time — DSL
    const dslParseStart = performance.now();
    for (let i = 0; i < 100; i++) parseDSL(scenario.dsl);
    const dslParseMs = (performance.now() - dslParseStart) / 100;

    // Get the DSL-generated payload for sending
    const dslPayload = parseDSL(scenario.dsl);
    const jsonPayload = JSON.parse(scenario.json);

    // Determine if this is an ask or draw scenario
    const isAsk = "questions" in jsonPayload;
    const endpoint = isAsk ? "ask" : "draw";

    // For ask scenarios, we can't do round-trip (blocks until user answers)
    // So we only measure draw scenarios for round-trip
    let jsonRoundtripMs = 0;
    let dslRoundtripMs = 0;

    if (!isAsk) {
      // Clear both canvases first
      await httpPost(`http://127.0.0.1:${jsonPort}/api/clear`, {});
      await httpPost(`http://127.0.0.1:${dslPort}/api/clear`, {});
      await new Promise((r) => setTimeout(r, 300));

      // JSON round-trip (parse + HTTP + render)
      const jsonRtStart = performance.now();
      const jsonParsed = JSON.parse(scenario.json);
      await httpPost(`http://127.0.0.1:${jsonPort}/api/${endpoint}`, jsonParsed);
      jsonRoundtripMs = performance.now() - jsonRtStart;

      // DSL round-trip (parse DSL + HTTP + render)
      const dslRtStart = performance.now();
      const dslParsed = parseDSL(scenario.dsl);
      await httpPost(`http://127.0.0.1:${dslPort}/api/${endpoint}`, dslParsed);
      dslRoundtripMs = performance.now() - dslRtStart;
    }

    const charReduction = ((1 - dslChars / jsonChars) * 100).toFixed(1);
    const tokenReduction = ((1 - dslTokensEst / jsonTokensEst) * 100).toFixed(1);

    results.push({
      scenario: scenario.name,
      jsonChars,
      dslChars,
      jsonTokensEst,
      dslTokensEst,
      charReduction: charReduction + "%",
      tokenReduction: tokenReduction + "%",
      jsonParseMs: Math.round(jsonParseMs * 1000) / 1000,
      dslParseMs: Math.round(dslParseMs * 1000) / 1000,
      jsonRoundtripMs: Math.round(jsonRoundtripMs * 100) / 100,
      dslRoundtripMs: Math.round(dslRoundtripMs * 100) / 100,
      coordValues,
    });

    // Print scenario result
    console.log(`  JSON: ${jsonChars} chars, ~${jsonTokensEst} tokens`);
    console.log(`  DSL:  ${dslChars} chars, ~${dslTokensEst} tokens`);
    console.log(`  Reduction: ${charReduction}% chars, ${tokenReduction}% tokens`);
    console.log(`  Coordinate values Claude must compute (JSON): ${coordValues}`);
    console.log(`  Parse time: JSON ${results[results.length - 1].jsonParseMs}ms, DSL ${results[results.length - 1].dslParseMs}ms`);
    if (!isAsk) {
      console.log(`  Round-trip: JSON ${jsonRoundtripMs.toFixed(1)}ms, DSL ${dslRoundtripMs.toFixed(1)}ms`);
    } else {
      console.log(`  Round-trip: skipped (ask blocks until user answers)`);
    }
    console.log("");
  }

  // ── Summary ──────────────────────────────────────────────────

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                      Summary                                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  const totalJsonChars = results.reduce((s, r) => s + r.jsonChars, 0);
  const totalDslChars = results.reduce((s, r) => s + r.dslChars, 0);
  const totalJsonTokens = results.reduce((s, r) => s + r.jsonTokensEst, 0);
  const totalDslTokens = results.reduce((s, r) => s + r.dslTokensEst, 0);
  const totalCoords = results.reduce((s, r) => s + r.coordValues, 0);

  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Input Size Comparison (what the LLM generates)              │");
  console.log("├─────────────────────┬──────────┬──────────┬─────────────────┤");
  console.log("│ Scenario            │   JSON   │   DSL    │   Reduction     │");
  console.log("├─────────────────────┼──────────┼──────────┼─────────────────┤");

  for (const r of results) {
    const name = r.scenario.substring(0, 19).padEnd(19);
    const jt = String(r.jsonTokensEst).padStart(5) + " tk";
    const dt = String(r.dslTokensEst).padStart(5) + " tk";
    const red = r.tokenReduction.padStart(7);
    console.log(`│ ${name} │ ${jt} │ ${dt} │ ${red}         │`);
  }

  console.log("├─────────────────────┼──────────┼──────────┼─────────────────┤");
  const tjt = String(totalJsonTokens).padStart(5) + " tk";
  const tdt = String(totalDslTokens).padStart(5) + " tk";
  const totalTokenRed = ((1 - totalDslTokens / totalJsonTokens) * 100).toFixed(1) + "%";
  console.log(`│ TOTAL               │ ${tjt} │ ${tdt} │ ${totalTokenRed.padStart(7)}         │`);
  console.log("└─────────────────────┴──────────┴──────────┴─────────────────┘");
  console.log("");

  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Key Metrics                                                 │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│ Total JSON characters:         ${String(totalJsonChars).padStart(7)}                     │`);
  console.log(`│ Total DSL characters:          ${String(totalDslChars).padStart(7)}                     │`);
  console.log(`│ Character reduction:           ${((1 - totalDslChars / totalJsonChars) * 100).toFixed(1).padStart(6)}%                    │`);
  console.log(`│ Total JSON tokens (est):       ${String(totalJsonTokens).padStart(7)}                     │`);
  console.log(`│ Total DSL tokens (est):        ${String(totalDslTokens).padStart(7)}                     │`);
  console.log(`│ Token reduction:               ${totalTokenRed.padStart(6)}%                    │`);
  console.log(`│ Coordinate values eliminated:  ${String(totalCoords).padStart(7)}                     │`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ What This Means for Claude                                  │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│ • ${totalCoords} fewer coordinate values to compute                    │`);
  console.log(`│ • ~${totalJsonTokens - totalDslTokens} fewer tokens to generate per equivalent output     │`);
  console.log(`│ • ${totalTokenRed} less output = proportionally faster response       │`);
  console.log(`│ • Zero mental math = fewer layout errors                    │`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  // Cleanup
  console.log("Stopping sessions...");
  stopSession(jsonSessionId);
  stopSession(dslSessionId);
  console.log("Done.");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
