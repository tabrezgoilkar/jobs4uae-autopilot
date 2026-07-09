import { describe, test, expect } from 'vitest';
import { buildUpskillHeatmap } from '../upskill/heatmap.js';

describe('buildUpskillHeatmap', () => {
  test('empty input yields empty cells', () => {
    expect(buildUpskillHeatmap([])).toEqual({ cells: [], totalJobs: 0 });
  });

  test('ranks by gapScore (demand x avgCost)', () => {
    const rows = [
      { jobTitle: 'Backend', missingSkills: ['kubernetes', 'aws'], fitScore: 40 }, // cost .6 each
      { jobTitle: 'Frontend', missingSkills: ['react'], fitScore: 90 }, // cost .1
      { jobTitle: 'Fullstack', missingSkills: ['kubernetes'], fitScore: 30 }, // cost .7
    ];
    const { cells, totalJobs } = buildUpskillHeatmap(rows);
    expect(totalJobs).toBe(3);
    // kubernetes: demand 2, avgCost (.6+.7)/2=.65 => gap 1.30 (highest)
    expect(cells[0].skill).toBe('kubernetes');
    expect(cells[0].demand).toBe(2);
    expect(cells[0].gapScore).toBeGreaterThan(cells.find((c) => c.skill === 'aws').gapScore);
  });

  test('dedupes skills within a single job', () => {
    const { cells } = buildUpskillHeatmap([{ jobTitle: 'X', missingSkills: ['go', 'go'], fitScore: 50 }]);
    expect(cells).toHaveLength(1);
    expect(cells[0].demand).toBe(1);
  });

  test('missing fitScore uses neutral 0.5 cost', () => {
    const { cells } = buildUpskillHeatmap([{ jobTitle: 'X', missingSkills: ['python'] }]);
    expect(cells[0].avgCost).toBeCloseTo(0.5, 5);
  });

  test('heat buckets scale with data volume', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ jobTitle: `J${i}`, missingSkills: ['rust'], fitScore: 10 }));
    const { cells } = buildUpskillHeatmap(many);
    // gapScore = 10 * 0.9 = 9, ratio = 9/10 = .9 => high
    expect(cells[0].heat).toBe('high');
  });
});
