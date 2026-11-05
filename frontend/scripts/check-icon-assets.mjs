import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const icons = JSON.parse(readFileSync(resolve(root, 'src/app/constants/icon-catalog-extra.json'), 'utf8'));
const sources = JSON.parse(readFileSync(resolve(root, 'public/assets/catalog/sources.json'), 'utf8'));
assert.equal(new Set(icons.map(icon => icon.id)).size, icons.length, 'Duplicate icon identifier');
let rasterBytes = 0, rasters = 0;
for (const icon of icons) {
  assert.match(icon.id, /^(2d|3d)-[a-z0-9-]{1,60}$/);
  assert.ok(icon.name && icon.group && icon.tags.length);
  assert.match(sources[icon.source]?.commit || '', /^[a-f0-9]{40}$/, 'Unpinned upstream source');
  assert.doesNotMatch(icon.svg, /<script|<foreignObject|\son\w+\s*=|javascript:|https?:/i);
  for (const [, url] of icon.svg.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.match(url, /^\/assets\/catalog\/fluent-[a-z0-9-]+\.png$/);
    const png = readFileSync(resolve(root, 'public', url.slice(1)));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 256); assert.equal(png.readUInt32BE(20), 256);
    rasters++; rasterBytes += png.length;
  }
}
for (const library of ['lucide', 'tabler', 'phosphor', 'fluent-emoji'])
  assert.ok(readFileSync(resolve(root, `public/assets/catalog/licenses/${library}.txt`), 'utf8').includes('Copyright'));
console.log(JSON.stringify({ icons: icons.length, twoD: icons.filter(icon => icon.type === '2d').length,
  threeD: icons.filter(icon => icon.type === '3d').length, localRasters: rasters, rasterBytes }));
