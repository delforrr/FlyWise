import { bloquearRecurso } from '../../prisma/bloqueo-transaccional.js';
import type { Transaction } from '../../prisma/db.js';
import { CronExclusivo } from './cron-mensual.js';

export const PROCESO_OAG_ID = '00000000-0000-4000-8000-000000000020';

export function expresionCronOag(programacion: unknown) {
  return (
    (programacion as { expresionCron?: string } | null)?.expresionCron ?? ''
  );
}

export function bloquearConfiguracionCron(tx: Transaction) {
  return bloquearRecurso(tx, 'admisiones');
}

export const cronOperaciones = new CronExclusivo({
  OAG: async (tx) => {
    const proceso = await tx.orm.public.ProcesoEtl.first({
      id: PROCESO_OAG_ID,
    });
    return (
      !!proceso &&
      !proceso.pausado &&
      !!expresionCronOag(proceso.configuracionProgramacion)
    );
  },
  BTS: async (tx) => {
    const config = await tx.orm.public.ConfiguracionBts.first({ id: true });
    return !!config && !config.pausado && !!config.expresionCron;
  },
});
