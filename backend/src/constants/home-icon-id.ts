import codepoints from './emoji-codepoints.json';

const emojis = new Set(codepoints.map(code => `emoji-${code}`));
/** Only bounded catalog identifiers; emoji sequences must exist in Unicode 17. */
export function isHomeIconId(value: string): boolean {
  return /^(2d|3d)-[a-z0-9-]{1,60}$/.test(value) || emojis.has(value);
}
