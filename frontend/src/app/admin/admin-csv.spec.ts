import { describe, expect, it } from 'vitest';
import { safeCsvCell } from './admin-csv';

describe('Admin CSV export', () => {
  it('prevents spreadsheet formulas and embedded rows from customer controlled names', () => {
    expect(safeCsvCell('=HYPERLINK("https://example.test")'))
      .toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(safeCsvCell('  +1\r\n=cmd')).toBe('"\'  +1  =cmd"');
    expect(safeCsvCell('Café Central')).toBe('"Café Central"');
  });
});
