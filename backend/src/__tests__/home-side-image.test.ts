import { publicCustomConfig } from '../services/public-menu-presentation';
import { validateMenuArchive, remapMenuArchive } from '../services/menu-transfer.schema';
import { archiveFixture } from './fixtures/menu-archive';

it('public first-block image exposes only a safe image and explicit enabled flag', () => {
  expect(publicCustomConfig({first_block_image:{enabled:true,imageUrl:'/photo.webp',secret:'private'}})).toEqual({first_block_image:{enabled:true,imageUrl:'/photo.webp'}});
  expect(publicCustomConfig({first_block_image:{enabled:true,imageUrl:'javascript:alert(1)'}})).toEqual({first_block_image:{enabled:true,imageUrl:null}});
});
it('preserves the first-block image through archive validation and remapping', () => {
  const doc = archiveFixture();
  doc.design.custom_config.first_block_image = {enabled:true,imageUrl:'/assets/home.webp'};
  expect(remapMenuArchive(validateMenuArchive(doc)).design?.custom_config).toMatchObject({first_block_image:doc.design.custom_config.first_block_image});
  doc.design.custom_config.first_block_image.imageUrl = 'javascript:alert(1)';
  expect(() => validateMenuArchive(doc)).toThrow();
});
