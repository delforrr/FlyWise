import { ConflictException } from '@nestjs/common';

export function errorCatalogo(error: unknown): never {
  if (
    error instanceof Error &&
    'sqlState' in error &&
    error.sqlState === '23505'
  ) {
    throw new ConflictException(
      'La identidad o la oferta ya existe en el catálogo',
    );
  }
  throw error;
}
