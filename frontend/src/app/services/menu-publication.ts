import { Observable, catchError, defer, map, of, switchMap, throwError } from 'rxjs';
import { imageSaveError } from './image-payload.service';

type PublicationStage = 'design' | 'media' | 'publication';
interface PublicationOperations {
  design: () => Observable<unknown>;
  media: () => Observable<unknown>;
  publication: () => Observable<unknown>;
  refresh: () => Observable<unknown>;
}

class PublicationError extends Error {
  constructor(readonly stage: PublicationStage, readonly reason: unknown) { super(stage); }
}

// Only the three required writes determine whether publication succeeded.
export function publishMenu(operations: PublicationOperations): Observable<{ refreshed: boolean }> {
  const required = (stage: PublicationStage) => defer(operations[stage]).pipe(
    map(response => {
      if ((response as any)?.success === false) throw { error: response };
      return response;
    }),
    catchError(reason => throwError(() => new PublicationError(stage, reason)))
  );
  return required('design').pipe(
    switchMap(() => required('media')),
    switchMap(() => required('publication')),
    switchMap(() => defer(operations.refresh).pipe(
      map(() => ({ refreshed: true })),
      catchError(() => of({ refreshed: false }))
    ))
  );
}

export function publicationErrorMessage(error: unknown): string {
  const failure = error instanceof PublicationError ? error : new PublicationError('publication', error);
  const reason = failure.reason as any;
  const code = reason?.error?.error?.code;
  if (code === 'THEMATIC_TEMPLATE_REQUIRES_PLAN') return 'Publique este template com o Basic ou superior. Seu design continua disponível no preview.';
  if (code === 'MENU_NEEDS_PRODUCT') return 'Adicione pelo menos um produto antes de publicar o cardápio.';
  if (code === 'ACCOUNT_NOT_ACTIVE') return 'Sua conta precisa estar ativa para publicar o cardápio.';
  if (reason?.status === 401) return 'Sua sessão expirou. Entre novamente para publicar o cardápio.';
  if (reason?.status === 429) return 'Muitas tentativas de publicação. Aguarde um pouco e tente novamente.';
  const messages: Record<PublicationStage, string> = {
    design: 'Não foi possível salvar o design antes de publicar. Tente novamente.',
    media: 'Não foi possível publicar as mídias dos produtos. Tente novamente.',
    publication: 'Não foi possível liberar o cardápio online. Tente novamente.'
  };
  return imageSaveError(reason, messages[failure.stage]);
}

export function publicationNeedsTemplateUpgrade(error: unknown): boolean {
  const reason = error instanceof PublicationError ? error.reason : error;
  return (reason as any)?.error?.error?.code === 'THEMATIC_TEMPLATE_REQUIRES_PLAN';
}
