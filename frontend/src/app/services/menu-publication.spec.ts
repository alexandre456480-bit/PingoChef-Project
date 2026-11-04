import { firstValueFrom, of, throwError } from 'rxjs';
import { publicationErrorMessage, publishMenu } from './menu-publication';
import { ImagePayloadError } from './image-payload.service';

describe('Menu publication', () => {
  const setup = () => ({
    design: vi.fn(() => of({ success: true })),
    media: vi.fn(() => of({ success: true })),
    publication: vi.fn(() => of({ success: true, data: { published: true } })),
    refresh: vi.fn(() => of([]))
  });

  it('reports success even when refreshing the catalogue fails after publication', async () => {
    const operations = setup();
    operations.refresh.mockReturnValue(throwError(() => ({ status: 500 })));
    expect(await firstValueFrom(publishMenu(operations))).toEqual({ refreshed: false });
    expect(operations.publication).toHaveBeenCalledOnce();
  });

  it('reports a complete publication and refresh', async () => {
    expect(await firstValueFrom(publishMenu(setup()))).toEqual({ refreshed: true });
  });

  it('blocks publication when saving the design fails and retains image guidance', async () => {
    const operations = setup();
    operations.design.mockReturnValue(throwError(() => new ImagePayloadError('Escolha uma imagem menor.')));
    const failure = await firstValueFrom(publishMenu(operations)).catch(error => error);
    expect(publicationErrorMessage(failure)).toBe('Escolha uma imagem menor.');
    expect(operations.media).not.toHaveBeenCalled();
    expect(operations.publication).not.toHaveBeenCalled();
  });

  it('blocks publication when publishing media fails', async () => {
    const operations = setup();
    operations.media.mockReturnValue(throwError(() => ({ status: 500 })));
    const failure = await firstValueFrom(publishMenu(operations)).catch(error => error);
    expect(publicationErrorMessage(failure)).toContain('mídias dos produtos');
    expect(operations.publication).not.toHaveBeenCalled();
    expect(operations.refresh).not.toHaveBeenCalled();
  });

  it('explains the missing product requirement and does not refresh a failed publication', async () => {
    const operations = setup();
    operations.publication.mockReturnValue(throwError(() => ({ status: 400, error: { error: { code: 'MENU_NEEDS_PRODUCT' } } })));
    const failure = await firstValueFrom(publishMenu(operations)).catch(error => error);
    expect(publicationErrorMessage(failure)).toContain('pelo menos um produto');
    expect(operations.refresh).not.toHaveBeenCalled();
  });

  it('rejects an unsuccessful response even with HTTP 200', async () => {
    const operations = setup();
    operations.media.mockReturnValue(of({ success: false }));
    await expect(firstValueFrom(publishMenu(operations))).rejects.toThrow();
    expect(operations.publication).not.toHaveBeenCalled();
  });
});
