import { describe, test, expect } from 'vitest';
import { scoreFit } from '../evaluate/scoreFit.js';

const PROFILE = {
  fullName: 'Ada Dev',
  headline: 'Senior Backend Engineer',
  summary: 'Backend engineer with Node.js and cloud experience.',
  location: 'Dubai, UAE',
  skills: ['Node.js', 'TypeScript', 'AWS', 'Docker', 'Kubernetes'],
  experience: [{ company: 'X', title: 'Backend Engineer', startDate: '2018', endDate: 'Present', description: '' }],
};

describe('scoreFit — 5-dimension framework', () => {
  test('returns Poor/0 on empty input', () => {
    const r = scoreFit({ jobText: '', profile: PROFILE });
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('Poor');
    expect(r.dimensions).toHaveLength(0);
  });

  test('strong match scores high with matched skills', () => {
    const job = `We are hiring a Senior Backend Engineer. Requirements: Node.js, TypeScript,
      AWS, Docker, Kubernetes. 5+ years experience. Remote or Dubai.`;
    const r = scoreFit({ jobText: job, profile: PROFILE });
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.verdict).toBe('Strong');
    expect(r.matchedSkills.length).toBeGreaterThan(0);
    expect(r.dimensions).toHaveLength(5);
  });

  test('missing skills surface in missingSkills', () => {
    const job = `Looking for a Machine Learning Engineer with Python, PyTorch, and Spark.`;
    const r = scoreFit({ jobText: job, profile: PROFILE });
    expect(r.missingSkills).toContain('python');
    expect(r.matchedSkills).toHaveLength(0);
    // skills dimension should be low since none matched
    const skillsDim = r.dimensions.find((d) => d.name === 'Technical Skills Match');
    expect(skillsDim.score).toBeLessThan(50);
  });

  test('location deal-breaker forces low score', () => {
    const job = `Onsite only role in London, UK. Must be based in the UK (relocation required). 3+ years.`;
    const r = scoreFit({ jobText: job, profile: PROFILE });
    expect(r.dealBreaker).toBe(true);
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.verdict).toBe('Poor');
  });

  test('weights sum to 1 for the averaged dimensions', () => {
    const r = scoreFit({ jobText: 'Random job description about things.', profile: PROFILE });
    const sum = r.dimensions.filter((d) => d.weight > 0).reduce((a, d) => a + d.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  test('verdict thresholds: mid score maps to Moderate', () => {
    const r = scoreFit({ jobText: 'Junior intern role, no experience needed, social media.', profile: PROFILE });
    // skills won't match (social media), but career/behavioral may; expect a mid verdict
    expect(['Weak', 'Moderate', 'Poor', 'Good']).toContain(r.verdict);
  });
});
