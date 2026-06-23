import { describe, it, expect } from 'vitest';
import { isBlockedAddress } from '../lib/ssrf.js';

describe('isBlockedAddress', () => {
  it('blocks IPv4 loopback / private / link-local / reserved ranges', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it('blocks IPv6 loopback / ULA / link-local and v4-mapped loopback', () => {
    for (const ip of ['::1', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6', () => {
    expect(isBlockedAddress('2001:4860:4860::8888')).toBe(false);
  });
});
