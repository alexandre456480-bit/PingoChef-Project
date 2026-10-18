import { homeIconChoice } from './home-icons';

describe('Home icon choices', () => {
  it('distinguishes unchanged defaults, catalog IDs and explicitly no icon', () => {
    expect(homeIconChoice({}, 'home')).toBeUndefined();
    expect(homeIconChoice({ home_icons: { home: '3d-bistro' } }, 'home')).toBe('3d-bistro');
    expect(homeIconChoice({ home_icons: { home: null } }, 'home')).toBeNull();
  });
  it('falls back for invalid, removed or inherited entries without accepting markup', () => {
    for (const value of ['<svg onload=alert(1)>', 'https://example.test/icon.svg', '3d-nonexistent', 1, {}])
      expect(homeIconChoice({ home_icons: { home: value } }, 'home')).toBeUndefined();
    expect(homeIconChoice({ home_icons: Object.create({ home: null }) }, 'home')).toBeUndefined();
    expect(homeIconChoice({ home_icons: [] }, 'home')).toBeUndefined();
  });
});
