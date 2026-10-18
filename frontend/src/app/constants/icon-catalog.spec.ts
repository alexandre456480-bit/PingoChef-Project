import { ICON_CATALOG, ICON_GROUPS, findCatalogIcon } from './icon-catalog';
import { emojiEntries, EmojiRecord } from './emoji-catalog';
import emojiRecords from '../../../public/assets/catalog/emojis-pt.json';
import frontendCodes from './emoji-codepoints.json';
import backendCodes from '../../../../backend/src/constants/emoji-codepoints.json';

describe('Expanded icon catalog', () => {
  it('keeps legacy artwork, unique IDs and multiple locally bundled libraries', () => {
    expect(new Set(ICON_CATALOG.map(icon => icon.id)).size).toBe(ICON_CATALOG.length);
    expect(ICON_CATALOG.length).toBeGreaterThan(240);
    expect(findCatalogIcon('sushi')).toBe(findCatalogIcon('2d-sushi'));
    for (const source of ['Lucide', 'Tabler', 'Phosphor', 'Fluent Emoji'])
      expect(ICON_CATALOG.some(icon => icon.source === source)).toBe(true);
    expect(ICON_GROUPS).toContain('Corações & Afeto');
    expect(ICON_GROUPS).toContain('Prêmios & Conquistas');
    for (const icon of ICON_CATALOG) {
      expect(icon.svg).not.toMatch(/<script|<foreignObject|\son\w+=|javascript:/i);
      for (const [, url] of icon.svg.matchAll(/(?:href|src)="([^"]+)"/g))
        expect(url).toMatch(/^\/assets\/catalog\/fluent-[a-z0-9-]+\.png$/);
    }
  });
  it('covers the same full Unicode inventory in picker, renderer and backend', () => {
    expect(frontendCodes).toEqual(backendCodes);
    expect(frontendCodes.length).toBeGreaterThan(3900);
    const entries = emojiEntries(emojiRecords as EmojiRecord[]);
    expect(entries.map(icon => icon.id.slice(6))).toEqual(frontendCodes);
    for (const icon of entries) {
      expect(icon.name).toBeTruthy(); expect(icon.emoji).toBeTruthy();
      expect(findCatalogIcon(icon.id)?.emoji).toBe(icon.emoji);
    }
    for (const id of ['emoji-d800', 'emoji-3c', 'emoji-110000', 'emoji-2764-<svg>', 'emoji-1f600-1f600'])
      expect(findCatalogIcon(id)).toBeUndefined();
  });
});
