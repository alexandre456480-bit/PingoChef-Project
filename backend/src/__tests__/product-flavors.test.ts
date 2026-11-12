import { itemSchema } from '../controllers/item.controller';
import { productFlavorsSchema } from '../utils/product-flavors';
import { validateMenuArchive, remapMenuArchive } from '../services/menu-transfer.schema';
import { archiveFixture } from './fixtures/menu-archive';

const flavor = { id: '11111111-1111-4111-8111-111111111111', name: 'Frango', price: null, isAvailable: true };
it('validates bounded flavor data and leaves omission intact for older editors', () => {
  expect(productFlavorsSchema.parse([flavor, { ...flavor, id: '22222222-2222-4222-8222-222222222222', name: 'Picanha', price: 18 }])).toHaveLength(2);
  expect(itemSchema.parse({ name: 'Produto', categoryId: 'cat', price: 10 })).not.toHaveProperty('flavors');
});
it.each([[{ ...flavor, price: -1 }], [{ ...flavor, price: Infinity }], [{ ...flavor, name: '<script>' }], [flavor, flavor], [{ ...flavor, businessId: 'other' }], Array(31).fill(flavor)])('rejects invalid or ambiguous flavor data', rows => {
  expect(productFlavorsSchema.safeParse(rows).success).toBe(false);
});
it('preserves flavors in portable archives while remapping their parent product', () => {
  const archive = archiveFixture(); archive.items[0].flavors = [flavor];
  const parsed = validateMenuArchive(archive), remapped = remapMenuArchive(parsed);
  expect(remapped.items[0].id).not.toBe(parsed.items[0].id);
  expect(remapped.items[0].flavors).toEqual([flavor]);
  delete archive.items[0].flavors;
  expect(validateMenuArchive(archive).items[0].flavors).toBeUndefined();
});
