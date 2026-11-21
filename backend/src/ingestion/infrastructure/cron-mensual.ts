import { BadRequestException, ConflictException } from '@nestjs/common';
import { defaultRepeatStrategy } from 'bullmq';
import type { Transaction } from '../../prisma/db.js';

export function validarCronMensual(expresion: string) {
  if (!expresion) return;
  if (
    !/^[0-5]?\d (?:[01]?\d|2[0-3]) (?:[1-9]|[12]\d|3[01]) \* \*$/.test(
      expresion,
    )
  )
    throw new BadRequestException('La programación debe ser mensual');
  try {
    defaultRepeatStrategy(Date.now(), { pattern: expresion, tz: 'UTC' });
  } catch {
    throw new BadRequestException('Expresión cron inválida');
  }
}

export class CronExclusivo<Clave extends string> {
  constructor(
    private readonly activos: Record<
      Clave,
      (tx: Transaction) => Promise<boolean>
    >,
  ) {}

  async exigirDisponible(tx: Transaction, clave: Clave) {
    for (const alternativa of Object.keys(this.activos) as Clave[]) {
      if (alternativa !== clave && (await this.activos[alternativa](tx)))
        throw new ConflictException(`El cron de ${alternativa} está activo`);
    }
  }
}

export async function reconciliarCronMensual(
  expresion: string,
  programador: {
    leer(): Promise<
      | {
          pattern?: string;
          tz?: string;
          template?: { data?: { cron?: string } };
        }
      | undefined
    >;
    quitar(): Promise<unknown>;
    guardar(): Promise<unknown>;
  },
) {
  const actual = await programador.leer();
  if (!expresion) {
    if (actual) await programador.quitar();
    return;
  }
  if (
    actual?.pattern === expresion &&
    actual.tz === 'UTC' &&
    actual.template?.data?.cron === expresion
  )
    return;
  await programador.guardar();
}
