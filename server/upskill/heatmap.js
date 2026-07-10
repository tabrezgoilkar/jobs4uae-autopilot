// Upskill gap-heatmap aggregator.
//
// Turns your tracked applications + their evaluations into a prioritized list of
// skills to learn. Two signals per missing skill:
//   - frequency: how many tracked jobs wanted it (market demand)
//   - fitWeight: how much it cost you on average, (100 - fitScore)/100
//   - gapScore:  frequency * fitWeight  (the heat)
//
// Pure + deterministic — easy to test, no IO. The route joins applications to
// evaluations by evaluationId and feeds the rows in.

/**
 * @param {Array<{jobTitle?:string, missingSkills?:string[], fitScore?:number}>} rows
 * @returns {{cells: Array<{skill:string, demand:number, avgCost:number, gapScore:number, heat:'low'|'med'|'high', examples:string[]}>, totalJobs:number}}
 */
export function buildUpskillHeatmap(rows = []) {
  const totalJobs = rows.length;
  if (!totalJobs) return { cells: [], totalJobs: 0 };

  const bySkill = new Map();

  for (const row of rows) {
    const missing = Array.isArray(row.missingSkills) ? row.missingSkills.map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    const cost = typeof row.fitScore === 'number' ? (100 - clamp(row.fitScore, 0, 100)) / 100 : 0.5; // unknown => neutral
    const title = row.jobTitle || 'Untitled role';
    for (const skill of new Set(missing)) {
      if (!bySkill.has(skill)) {
        bySkill.set(skill, { demand: 0, costSum: 0, examples: [] });
      }
      const s = bySkill.get(skill);
      s.demand += 1;
      s.costSum += cost;
      if (s.examples.length < 3) s.examples.push(title);
    }
  }

  const cells = [...bySkill.entries()].map(([skill, s]) => {
    const avgCost = s.demand ? s.costSum / s.demand : 0;
    const gapScore = Number((s.demand * avgCost).toFixed(3));
    return {
      skill,
      demand: s.demand,
      avgCost: Number(avgCost.toFixed(3)),
      gapScore,
      heat: heat(gapScore, totalJobs),
      examples: s.examples,
    };
  });

  cells.sort((a, b) => b.gapScore - a.gapScore || b.demand - a.demand);
  return { cells, totalJobs };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function heat(gapScore, totalJobs) {
  // Normalize against the max possible (totalJobs * 1.0) so it scales with data.
  const ratio = totalJobs > 0 ? gapScore / totalJobs : 0;
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'med';
  return 'low';
}
