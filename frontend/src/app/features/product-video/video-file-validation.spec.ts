import {
  MAX_VIDEO_FILE_SIZE_BYTES,
  VideoFileValidationError,
  resolveAllowedVideoMime,
  validateVideoFile,
  validateVideoFileBasics
} from './video-file-validation';

function videoFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('video file validation', () => {
  it('accepts a supported video with exactly 15 seconds', async () => {
    const file = videoFile('produto.mp4', 'video/mp4');

    await expect(validateVideoFile(file, async () => 15)).resolves.toMatchObject({
      file,
      mimeType: 'video/mp4',
      durationSeconds: 15
    });
  });

  it('rejects local metadata above 15 seconds before upload intent', async () => {
    const file = videoFile('produto.mov', 'video/quicktime');

    await expect(validateVideoFile(file, async () => 15.001)).rejects.toMatchObject({
      code: 'VIDEO_DURATION_TOO_LONG',
      message: 'Seu vídeo deve ter no máximo 15 segundos.'
    });
  });

  it('rejects a file above 50 MB before reading duration', async () => {
    const oversized = {
      name: 'grande.mp4',
      type: 'video/mp4',
      size: MAX_VIDEO_FILE_SIZE_BYTES + 1
    } as File;
    const durationReader = vi.fn(async () => 5);

    await expect(validateVideoFile(oversized, durationReader)).rejects.toMatchObject({
      code: 'VIDEO_FILE_TOO_LARGE',
      message: 'Seu vídeo deve ter no máximo 50 MB.'
    });
    expect(durationReader).not.toHaveBeenCalled();
  });

  it('uses a safe extension fallback only when the browser omits MIME', () => {
    expect(resolveAllowedVideoMime({ name: 'produto.WEBM', type: '' })).toBe('video/webm');
    expect(resolveAllowedVideoMime({ name: 'produto.mp4', type: 'text/html' })).toBeNull();
    expect(() => validateVideoFileBasics(videoFile('ataque.html', 'text/html')))
      .toThrow(VideoFileValidationError);
  });
});

