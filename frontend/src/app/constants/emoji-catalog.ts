import codepoints from './emoji-codepoints.json';
import type { CatalogIcon } from './icon-catalog';

const known = new Set(codepoints);
export const EMOJI_GROUPS = ['Rostos & Emoções', 'Pessoas & Gestos', 'Componentes', 'Animais & Natureza',
  'Comidas & Bebidas', 'Viagens & Lugares', 'Atividades', 'Objetos', 'Símbolos', 'Bandeiras'];
export type EmojiRecord = [code: string, name: string, group: number, tags: string];
const labels = new Map<string, string>();

export function emojiIcon(id: string): CatalogIcon | undefined {
  if (!id.startsWith('emoji-') || !known.has(id.slice(6))) return undefined;
  const glyph = String.fromCodePoint(...id.slice(6).split('-').map(code => parseInt(code, 16)));
  return { id, name: labels.get(id) ?? `Emoji ${glyph}`, type: '2d', group: 'Emojis', source: 'Unicode', emoji: glyph,
    tags: [], svg: `<svg viewBox="0 0 36 36"><text x="18" y="28" text-anchor="middle" font-size="28" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${glyph}</text></svg>` };
}

export function emojiEntries(records: EmojiRecord[]): CatalogIcon[] {
  return records.map(([code, name, group, tags]) => {
    const id = `emoji-${code}`;
    labels.set(id, name);
    return { ...emojiIcon(id)!, name, tags: [tags, EMOJI_GROUPS[group]], emojiGroup: group };
  });
}
