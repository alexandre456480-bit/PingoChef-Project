export function safeCsvCell(input: unknown): string {
  const value = String(input ?? '').replace(/[\r\n\t]/g, ' ');
  const protectedValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}
