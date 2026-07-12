import { describe, it, expect } from 'vitest';
import { formatBullets } from './bullets';

describe('formatBullets', () => {
  it('strips bullet prefixes and normalizes to "- "', () => {
    const r = formatBullets('• Did a thing\n* Did another\n– Third one');
    expect(r.bullets).toEqual(['- Did a thing', '- Did another', '- Third one']);
    expect(r.changed).toBe(3);
  });

  it('merges wrapped continuation lines', () => {
    const r = formatBullets('Led the revamp\nof the billing system across 3 regions\n- Cut churn 20%');
    expect(r.bullets[0]).toBe('- Led the revamp of the billing system across 3 regions');
    expect(r.bullets).toHaveLength(2);
  });

  it('de-duplicates identical bullets', () => {
    const r = formatBullets('- Managed team\n- Managed team\n- Managed team');
    expect(r.bullets).toEqual(['- Managed team']);
  });

  it('reports no change when already clean', () => {
    const r = formatBullets('- Clean bullet one\n- Clean bullet two');
    expect(r.changed).toBe(0);
  });

  it('collapses internal whitespace', () => {
    const r = formatBullets('• Did    a    spaced    thing');
    expect(r.bullets[0]).toBe('- Did a spaced thing');
  });
});
