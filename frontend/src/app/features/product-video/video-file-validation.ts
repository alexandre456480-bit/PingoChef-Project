export const MAX_VIDEO_DURATION_SECONDS = 15;
export const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm'
] as const;

export type AllowedVideoMimeType = typeof ALLOWED_VIDEO_MIME_TYPES[number];

export interface ValidatedVideoFile {
  file: File;
  mimeType: AllowedVideoMimeType;
  durationSeconds: number;
}

export class VideoFileValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'VideoFileValidationError';
  }
}

const MIME_BY_EXTENSION: Record<string, AllowedVideoMimeType> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm'
};

export function resolveAllowedVideoMime(file: Pick<File, 'name' | 'type'>): AllowedVideoMimeType | null {
  if (ALLOWED_VIDEO_MIME_TYPES.includes(file.type as AllowedVideoMimeType)) {
    return file.type as AllowedVideoMimeType;
  }

  // Some mobile browsers omit File.type. Extension inference is UX only; the
  // backend and Mux remain authoritative for the real input.
  if (!file.type) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return MIME_BY_EXTENSION[extension] ?? null;
  }
  return null;
}

export function validateVideoFileBasics(file: File): AllowedVideoMimeType {
  const mimeType = resolveAllowedVideoMime(file);
  if (!mimeType) {
    throw new VideoFileValidationError(
      'VIDEO_TYPE_NOT_ALLOWED',
      'Escolha um vídeo MP4, MOV ou WebM.'
    );
  }
  if (file.size < 1) {
    throw new VideoFileValidationError('VIDEO_EMPTY_FILE', 'O arquivo selecionado está vazio.');
  }
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new VideoFileValidationError(
      'VIDEO_FILE_TOO_LARGE',
      'Seu vídeo deve ter no máximo 50 MB.'
    );
  }
  return mimeType;
}

export function readLocalVideoDuration(file: File, timeoutMs = 12_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const timeout = window.setTimeout(() => finish(() => reject(
      new VideoFileValidationError(
        'VIDEO_METADATA_TIMEOUT',
        'Não foi possível ler o vídeo. Tente outro arquivo.'
      )
    )), timeoutMs);

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(() => {
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new VideoFileValidationError(
            'VIDEO_DURATION_INVALID',
            'Não foi possível confirmar a duração do vídeo.'
          ));
          return;
        }
        resolve(duration);
      });
    };
    video.onerror = () => finish(() => reject(new VideoFileValidationError(
      'VIDEO_METADATA_INVALID',
      'O arquivo não parece ser um vídeo válido.'
    )));
    video.src = objectUrl;
  });
}

export async function validateVideoFile(
  file: File,
  durationReader: (value: File) => Promise<number> = readLocalVideoDuration
): Promise<ValidatedVideoFile> {
  const mimeType = validateVideoFileBasics(file);
  const durationSeconds = await durationReader(file);
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoFileValidationError(
      'VIDEO_DURATION_TOO_LONG',
      'Seu vídeo deve ter no máximo 15 segundos.'
    );
  }
  return { file, mimeType, durationSeconds };
}
