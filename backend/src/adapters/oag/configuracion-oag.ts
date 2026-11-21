import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  reconciliarCronMensual,
  validarCronMensual,
} from '../../ingestion/infrastructure/cron-mensual.js';
import {
  bloquearConfiguracionCron,
  cronOperaciones,
  expresionCronOag,
  PROCESO_OAG_ID as PROCESO_ID,
} from '../../ingestion/infrastructure/cron-operaciones.js';
import { periodosCerradosMapa } from '../../metrics/periodos-mapa.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ParametrosTramoOag,
  TramoOag,
} from '../../ingestion/application/oag/alcance-oag.js';
import { OAG_CLAVE_ENTORNO } from './flight-info.js';
import { OAG_QUEUE, type TrabajoOag } from './cola-oag.js';
import type { ConfiguracionOagDto } from './oag.dto.js';

const configuracionInicial = {
  origenId: '',
  destinoId: '',
  periodo: '',
  coberturaMinimaPct: 90,
  pausado: true,
} satisfies ConfiguracionOagDto;
@Injectable()
export class ConfiguracionOag {
  private readonly logger = new Logger(ConfiguracionOag.name);
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OAG_QUEUE) private readonly queue: Queue<TrabajoOag>,
  ) {}

  async inicializar() {
    await this.prisma.models.ProcesoEtl.createAndCount(
      [
        {
          id: PROCESO_ID,
          nombre: 'OAG Flight Info v2',
          nombreConjunto: 'Operaciones de vuelos',
          entidadDestino: 'otp_metrics',
          esSistema: true,
          pausado: true,
          conexion: {
            ...configuracionInicial,
            claveEntorno: OAG_CLAVE_ENTORNO,
          },
          mapeoEsquema: [],
          configuracionProgramacion: {},
        },
      ],
      { onConflict: 'skip' },
    );
  }

  async configuracion(): Promise<ConfiguracionOagDto> {
    const proceso = await this.prisma.models.ProcesoEtl.first({
      id: PROCESO_ID,
    });
    if (!proceso) return configuracionInicial;
    return this.leerConfiguracion(proceso);
  }

  leerConfiguracion(proceso: {
    pausado: boolean;
    conexion: unknown;
    configuracionProgramacion: unknown;
  }): ConfiguracionOagDto {
    const conexion = proceso.conexion as Omit<ConfiguracionOagDto, 'pausado'>;
    const principal = conexion.tramos?.[0] ?? conexion;
    const cron = expresionCronOag(proceso.configuracionProgramacion);
    return {
      pausado: proceso.pausado,
      origenId: principal.origenId,
      destinoId: principal.destinoId,
      periodo: conexion.periodo,
      coberturaMinimaPct:
        conexion.coberturaMinimaPct ?? configuracionInicial.coberturaMinimaPct,
      ...(conexion.tramos && { tramos: conexion.tramos }),
      ...(cron && { expresionCron: cron }),
    };
  }

  async configurar({
    pausado,
    expresionCron,
    tramos,
    ...alcance
  }: ConfiguracionOagDto) {
    validarCronMensual(expresionCron ?? '');
    await this.resolverTramos({ ...alcance, tramos });
    await this.prisma.db.transaction(async (tx) => {
      await bloquearConfiguracionCron(tx);
      const actual = await tx.orm.public.ProcesoEtl.first({ id: PROCESO_ID });
      const cron =
        expresionCron ?? expresionCronOag(actual?.configuracionProgramacion);
      if (!pausado && cron) await cronOperaciones.exigirDisponible(tx, 'OAG');
      await tx.orm.public.ProcesoEtl.where({ id: PROCESO_ID }).update({
        pausado,
        conexion: {
          ...alcance,
          ...(tramos && {
            tramos: tramos.map(({ origenId, destinoId }) => ({
              origenId,
              destinoId,
            })),
          }),
          claveEntorno: OAG_CLAVE_ENTORNO,
        },
        configuracionProgramacion: { expresionCron: cron },
      });
    });
    await this.sincronizarCron();
    return this.configuracion();
  }

  async actualizarProceso(
    datos: {
      pausado: boolean;
      nombre?: string;
      conexion?: { periodo: string };
    },
    expresionCron?: string,
  ) {
    validarCronMensual(expresionCron ?? '');
    const actualizado = await this.prisma.db.transaction(async (tx) => {
      await bloquearConfiguracionCron(tx);
      const proceso = await tx.orm.public.ProcesoEtl.first({ id: PROCESO_ID });
      if (!proceso) return null;
      const cron =
        expresionCron ?? expresionCronOag(proceso.configuracionProgramacion);
      if (!datos.pausado && cron)
        await cronOperaciones.exigirDisponible(tx, 'OAG');
      return tx.orm.public.ProcesoEtl.where({ id: PROCESO_ID }).update({
        ...datos,
        ...(expresionCron != null && {
          configuracionProgramacion: { expresionCron: cron },
        }),
      });
    });
    await this.sincronizarCron();
    return actualizado;
  }

  async sincronizarCron() {
    try {
      const { pausado, expresionCron } = await this.configuracion();
      const cron = pausado ? '' : (expresionCron ?? '');
      const id = 'oag-mensual';
      await reconciliarCronMensual(cron, {
        leer: () => this.queue.getJobScheduler(id),
        quitar: () => this.queue.removeJobScheduler(id),
        guardar: () =>
          this.queue.upsertJobScheduler(
            id,
            { pattern: cron, tz: 'UTC' },
            {
              name: 'programada',
              data: { cron, ejecucionId: '' },
              opts: { removeOnComplete: 10, removeOnFail: 10 },
            },
          ),
      });
    } catch {
      this.logger.warn('OAG: sincronización de cron pendiente de recuperación');
    }
  }

  resolverTramos(config: Omit<ConfiguracionOagDto, 'pausado'>) {
    const { origenId, destinoId, periodo, coberturaMinimaPct } = config;
    const tramos =
      config.tramos ?? (origenId && destinoId ? [{ origenId, destinoId }] : []);
    if (!tramos.length)
      throw new BadRequestException('Seleccioná al menos un tramo');
    const claves = new Set(
      tramos.map(({ origenId, destinoId }) =>
        JSON.stringify([origenId, destinoId]),
      ),
    );
    if (claves.size !== tramos.length)
      throw new BadRequestException('Los tramos deben ser distintos');
    return Promise.all(
      tramos.map(({ origenId, destinoId }) =>
        this.resolverAlcance({
          origenId,
          destinoId,
          periodo,
          coberturaMinimaPct,
        }),
      ),
    );
  }

  async resolverAlcance(config: ParametrosTramoOag): Promise<TramoOag> {
    if (!periodosCerradosMapa().includes(config.periodo))
      throw new BadRequestException(
        'Seleccioná uno de los últimos 12 meses cerrados',
      );
    if (config.origenId === config.destinoId)
      throw new BadRequestException('Origen y destino deben ser distintos');
    const aeropuertos = this.prisma.models.Aeropuerto;
    const [origen, destino] = await Promise.all(
      [config.origenId, config.destinoId].map((id) =>
        aeropuertos.first({ id, archivadoEn: null }),
      ),
    );
    if (!origen || !destino)
      throw new BadRequestException('Aeropuerto no disponible');
    for (const campo of ['iata', 'icao'] as const) {
      const origenCodigo = origen[campo];
      const destinoCodigo = destino[campo];
      if (!origenCodigo || !destinoCodigo || origenCodigo === destinoCodigo)
        continue;
      const [origenes, destinos] = await Promise.all(
        [origenCodigo, destinoCodigo].map((codigo) =>
          aeropuertos
            .where({ [campo]: codigo, archivadoEn: null })
            .limit(2)
            .all(),
        ),
      );
      if (origenes.length === 1 && destinos.length === 1)
        return {
          ...config,
          origenCodigo,
          destinoCodigo,
          tipoCodigo: campo === 'iata' ? 'IATA' : 'ICAO',
        };
    }
    throw new BadRequestException(
      'El tramo no tiene códigos IATA o ICAO inequívocos',
    );
  }
}
