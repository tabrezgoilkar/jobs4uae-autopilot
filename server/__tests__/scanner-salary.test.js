import { describe, it, expect } from 'vitest';
import { normalizeSalary, buildSalaryPrompt } from '../scanner/salary.js';

describe('normalizeSalary', () => {
  it('keeps numeric low/high and defaults period to month', () => {
    const s = normalizeSalary({ low: 15000, high: 25000, currency: 'AED' });
    expect(s).toEqual({ low: 15000, high: 25000, currency: 'AED', period: 'month', note: '' });
  });

  it('strips commas/symbols from stringy numbers', () => {
    const s = normalizeSalary({ low: 'AED 15,000', high: '25,000', currency: 'AED', period: 'month' });
    expect(s.low).toBe(15000);
    expect(s.high).toBe(25000);
  });

  it('normalizes period to year when annual', () => {
    expect(normalizeSalary({ low: 1, high: 2, period: 'year' }).period).toBe('year');
    expect(normalizeSalary({ low: 1, high: 2, period: 'annual' }).period).toBe('year');
    expect(normalizeSalary({ low: 1, high: 2, period: 'monthly' }).period).toBe('month');
  });

  it('returns null low/high when the AI gives no usable numbers', () => {
    const s = normalizeSalary({ currency: 'AED', note: 'not enough data' });
    expect(s.low).toBeNull();
    expect(s.high).toBeNull();
    expect(s.note).toBe('not enough data');
  });

  it('does not throw on garbage input', () => {
    expect(() => normalizeSalary(undefined)).not.toThrow();
    expect(() => normalizeSalary('nope')).not.toThrow();
    expect(normalizeSalary(null).currency).toBeTypeOf('string');
  });
});

describe('buildSalaryPrompt', () => {
  it('includes the role title and GCC location and asks for a JSON range', () => {
    const p = buildSalaryPrompt('Accountant', 'UAE', 'Dubai');
    expect(p).toContain('Accountant');
    expect(p).toContain('UAE');
    expect(p).toContain('Dubai');
    expect(p.toLowerCase()).toContain('json');
  });
});
