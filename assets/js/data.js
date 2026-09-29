/*
 * Numbers reported in "Mid-Harness: Scaling Actions Between Model and Harness
 * for Terminal Agents". Unless noted, results are TMAX-9B on TerminalBench-Lite
 * (98 tasks, three runs per task). Pass@1 / Pass@3 are percentages.
 */
window.MH_DATA = (function () {
  'use strict';

  return {
    base: { pass1: 50.0, pass3: 69.39 },

    // Figure: candidate width (N) vs task success.
    candidateWidth: {
      widths: [1, 4, 8],
      series: [
        { key: 'listwise', label: 'Listwise', marker: 'circle',
          points: [[1, 50.0, 69.39], [4, 49.32, 66.33], [8, 51.02, 67.35]] },
        { key: 'pointwise', label: 'Pointwise', marker: 'square',
          points: [[1, 50.0, 69.39], [4, 52.72, 68.37], [8, 52.38, 67.35]] },
        { key: 'pairwise', label: 'Zero-shot pairwise', marker: 'diamond',
          points: [[1, 50.0, 69.39], [4, 54.42, 68.37], [8, 54.76, 71.43]] },
        { key: 'distilled', label: 'Distilled pairwise', marker: 'circle',
          points: [[1, 50.0, 69.39], [4, 55.44, 70.41], [8, 57.14, 75.51]] },
        { key: 'frontier', label: 'Frontier verifier (GPT-5.6 Sol, listwise)', marker: 'triangle', noLine: true,
          points: [[4, 64.63, 76.53], [8, 68.03, 80.61]] }
      ],
      proxy: { n: 8, pass1: 49.66, pass3: 66.33 }
    },

    // Verification mechanisms at N = 8 (zero-shot TMAX-9B verifier unless noted).
    mechanisms: {
      listwise: { calls: '1', pass1: 51.02, pass3: 67.35, verifierOutK: 0.6 },
      pointwise: { calls: '8', pass1: 52.38, pass3: 67.35, verifierOutK: 7.0 },
      pairwise: { calls: 'up to 28', pass1: 54.76, pass3: 71.43, verifierOutK: 125.7,
                  distilledPass1: 57.14, distilledPass3: 75.51 }
    },

    // Table: composing action and trajectory scaling. [Pass@1, Pass@3]; Best-of-T has no Pass@3.
    composition: [
      { bot: 0, sr: 0, zs: 0, dist: 0, env: 1, m4: [38.78, 57.14], m9: [50.0, 69.39], m27: [71.09, 82.65] },
      { bot: 1, sr: 0, zs: 0, dist: 0, env: 3, m4: [34.69, null], m9: [55.1, null], m27: [73.47, null] },
      { bot: 0, sr: 1, zs: 0, dist: 0, env: 2, m4: [41.5, 57.14], m9: [55.1, 71.43], m27: [72.79, 84.69] },
      { bot: 0, sr: 0, zs: 1, dist: 0, env: 1, m4: [41.5, 57.14], m9: [54.76, 71.43], m27: [73.13, 84.69] },
      { bot: 1, sr: 0, zs: 1, dist: 0, env: 3, m4: [39.8, null], m9: [61.22, null], m27: [77.55, null] },
      { bot: 0, sr: 1, zs: 1, dist: 0, env: 2, m4: [44.22, 59.18], m9: [56.8, 73.47], m27: [74.15, 82.65] },
      { bot: 0, sr: 0, zs: 0, dist: 1, env: 1, m4: [43.88, 58.16], m9: [57.14, 75.51], m27: [76.19, 86.73] },
      { bot: 1, sr: 0, zs: 0, dist: 1, env: 3, m4: [46.94, null], m9: [66.33, null], m27: [80.61, null] },
      { bot: 0, sr: 1, zs: 0, dist: 1, env: 2, m4: [46.6, 62.24], m9: [60.2, 75.51], m27: [75.85, 85.71] }
    ],

    // Pass@1 against reference-priced token cost per run (USD), TMAX-9B on TerminalBench-Lite.
    // From the paper's cost figure (figures/scaling_cost/data.csv) at OpenRouter Qwen3.5-9B rates,
    // $0.08 / $0.13 per million input / output tokens. Sequential Refine points are left out.
    cost: [
      { key: 'base', usd: 0.0443, pass1: 50.0 },
      { key: 'bot', tag: 'T = 3', usd: 0.3390, pass1: 55.10 },
      { key: 'bot', tag: 'T = 5', usd: 0.6195, pass1: 57.14 },
      { key: 'bot', tag: 'T = 7', usd: 0.9066, pass1: 59.18 },
      { key: 'zs', tag: 'N = 4', usd: 0.0855, pass1: 54.42 },
      { key: 'zs', tag: 'N = 8', usd: 0.1740, pass1: 54.76 },
      { key: 'dist', tag: 'N = 4', usd: 0.0842, pass1: 55.44 },
      { key: 'dist', tag: 'N = 8', usd: 0.2073, pass1: 57.14 },
      { key: 'distbot', usd: 0.7970, pass1: 66.33 }
    ],

    // The same chart with one-token (decision-only) pairwise verification, from the paper's appendix figure.
    // Points were read from the vector figure and match its tables to 0.05; base agent and Best-of-T are unchanged.
    costJev: [
      { key: 'base', usd: 0.0443, pass1: 50.0 },
      { key: 'bot', tag: 'T = 3', usd: 0.3390, pass1: 55.10 },
      { key: 'bot', tag: 'T = 5', usd: 0.6195, pass1: 57.14 },
      { key: 'bot', tag: 'T = 7', usd: 0.9066, pass1: 59.18 },
      { key: 'zs', tag: 'N = 4', usd: 0.0603, pass1: 52.72 },
      { key: 'zs', tag: 'N = 8', usd: 0.1376, pass1: 56.12 },
      { key: 'dist', tag: 'N = 4', usd: 0.0667, pass1: 54.42 },
      { key: 'dist', tag: 'N = 8', usd: 0.1574, pass1: 59.18 },
      { key: 'distbot', usd: 0.6084, pass1: 65.31 }
    ],

    // Model scale (TerminalBench-Lite, Vanillux2): base agent, zero-shot and distilled Mid-Harness (N = 8).
    modelScale: [
      { model: 'TMAX-4B', base: [38.78, 57.14], zs: [41.5, 57.14], dist: [43.88, 58.16] },
      { model: 'TMAX-9B', base: [50.0, 69.39], zs: [54.76, 71.43], dist: [57.14, 75.51] },
      { model: 'TMAX-27B', base: [71.09, 82.65], zs: [73.13, 84.69], dist: [76.19, 86.73] }
    ],

    // Table: transfer across benchmarks, models, and harnesses. [Pass@1, Pass@3].
    transfer: [
      { bench: 'TerminalBench-Lite', model: 'Qwen3.5-9B', harness: 'Terminus-2', base: [40.48, 60.2], zs: [42.52, 61.22], dist: null },
      { bench: 'TerminalBench-Lite', model: 'Nemotron3.5 Lightning', harness: 'Terminus-2', base: [41.16, 55.1], zs: [43.2, 58.16], dist: null },
      { bench: 'Terminal-Bench 2.1', model: 'TMAX-9B', harness: 'Vanillux2', base: [21.72, 25.84], zs: [27.34, 35.96], dist: [26.59, 35.96] },
      { bench: 'Terminal-Bench 2.1', model: 'Nemotron3 Ultra', harness: 'Terminus-2', base: [50.94, 65.17], zs: [56.18, 66.29], dist: null },
      { bench: 'SWE-bench-Verified', note: 'Mini, 50 tasks', model: 'TMAX-9B', harness: 'Vanillux2', base: [46.67, 54.0], zs: [48.0, 58.0], dist: [48.67, 62.0] },
      { bench: 'FeatureBench-Mini', note: '23 CPU tasks', model: 'TMAX-9B', harness: 'Vanillux2', base: [1.45, 4.35], zs: [5.8, 17.39], dist: [7.25, 13.04] },
      { bench: 'FeatureBench-Mini', note: '23 CPU tasks', model: 'TMAX-27B', harness: 'Vanillux2', base: [17.39, 26.09], zs: [17.39, 34.78], dist: [23.19, 39.13] }
    ],

    // Offline agreement with the GPT-5.6 Sol teacher (21 held-out TMAX-15K tasks, N = 8).
    agreement: {
      zeroShot: { mae: 2.59, pairwise: 59.01, verification: 38.52 },
      distilled: { mae: 1.05, pairwise: 74.58, verification: 57.79 },
      byTurn: {
        bins: ['1–4', '5–8', '9–16', '17–32', '33+'],
        zeroShot: [57.69, 38.76, 38.14, 34.62, 28.48],
        distilled: [68.13, 57.87, 57.47, 54.07, 56.97]
      },
      failures: [
        { label: 'Candidate semantics', zeroShot: 951, distilled: 706 },
        { label: 'Execution feasibility', zeroShot: 975, distilled: 514 },
        { label: 'Action phase', zeroShot: 257, distilled: 138 },
        { label: 'Loop / redundancy', zeroShot: 430, distilled: 173 },
        { label: 'Task requirements', zeroShot: 362, distilled: 149 },
        { label: 'Visible evidence', zeroShot: 335, distilled: 124 },
        { label: 'Premature completion', zeroShot: 6, distilled: 4 },
        { label: 'Other', zeroShot: 12, distilled: 2 }
      ]
    },

    // Illustrative example for the overview and verification diagrams (schematic, not measured): the tests fail
    // with `No module named 'yaml'`, and the eight candidate fixes include traps (the pip package is pyyaml) and
    // shortcuts that hide the failure. Independent pointwise scores, and a ring + pivot pairwise tournament with
    // N = 8 and K = 4 pivots. Duels are [i, j, score_i, score_j]; the first `ringDuels` follow the seeded ring,
    // the rest form the pivot stage, which assumes the ring's top four are 2, 3, 5 and 7.
    demo: {
      candidates: ['pip install yaml', 'pytest || true', 'pip install pyyaml', 'cat pyproject.toml', 'rm -rf tests/', 'pip install -e .', 'conda install yaml', 'grep -rn yaml src/'],
      choice: 2,
      pointScores: [4, 2, 9, 6, 1, 8, 3, 5],
      ringDuels: 8,
      pivots: 4,
      duels: [
        [0, 5, 3, 8], [5, 3, 8, 6], [3, 6, 6, 2], [6, 2, 2, 9],
        [2, 7, 9, 5], [7, 1, 6, 2], [1, 4, 2, 1], [4, 0, 1, 3],
        [0, 2, 2, 9], [0, 3, 4, 6], [0, 7, 4, 5], [1, 2, 2, 9],
        [1, 3, 3, 6], [1, 5, 2, 8], [4, 2, 1, 9], [4, 3, 1, 6],
        [4, 5, 1, 8], [4, 7, 1, 5], [6, 5, 2, 8], [6, 7, 3, 5],
        [5, 7, 8, 4], [3, 7, 6, 5], [2, 3, 9, 6], [2, 5, 9, 8]
      ]
    },

    // The overview's next decided turn, after the fix: rerun the whole suite, or stop early, check only part of it,
    // or repeat the install. Same format; the pivot stage assumes the ring's top four are 0, 2, 3 and 5.
    demoNext: {
      candidates: ['pytest', 'git commit -am "fix"', 'pip show pyyaml', 'pytest -k config', 'pip install pyyaml', 'pytest -x -q', 'pip freeze', 'cat src/config.py'],
      choice: 0,
      ringDuels: 8,
      pivots: 4,
      duels: [
        [0, 3, 9, 6], [3, 6, 6, 2], [6, 1, 3, 1], [1, 5, 1, 8],
        [5, 2, 8, 5], [2, 7, 6, 3], [7, 4, 4, 2], [4, 0, 2, 9],
        [1, 0, 1, 9], [1, 2, 2, 5], [1, 3, 1, 6], [4, 2, 3, 5],
        [4, 3, 2, 6], [4, 5, 2, 8], [6, 0, 2, 9], [6, 2, 3, 5],
        [6, 5, 2, 8], [7, 0, 3, 9], [7, 3, 4, 6], [7, 5, 3, 8],
        [3, 5, 6, 8], [2, 3, 5, 6], [0, 2, 9, 5], [0, 5, 9, 7]
      ]
    }
  };
})();
