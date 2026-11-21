import type { BackoffStrategy } from 'bullmq';
import type {
  AvanceOag,
  CheckpointOag,
} from '../../ingestion/application/oag/alcance-oag.js';
import { FalloTransitorioOag } from './flight-info.js';

export const OAG_QUEUE = 'oag-queue';
export const INTENTOS_OAG = 5;

export type TrabajoOag = {
  ejecucionId: string;
  cron?: string;
  avance?: AvanceOag;
  checkpoint?: CheckpointOag;
  reintentarDesde?: number;
};

export const demoraReintentoOag: BackoffStrategy = (intento, _tipo, error) => {
  if (!(error instanceof FalloTransitorioOag)) return -1;
  if (error.reintentarDesde !== undefined)
    return Math.max(0, error.reintentarDesde - Date.now());
  return 2000 * 2 ** (intento - 1);
};
