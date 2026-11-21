import { ConfiguracionOag } from '../adapters/oag/configuracion-oag.js';
import { PROCESO_OAG_ID } from '../ingestion/infrastructure/cron-operaciones.js';
import { and, not, or } from '@prisma/orm-postgres/orm-client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OagService } from '../adapters/oag/oag.service.js';
import { BtsService } from '../bts/bts.service.js';
import type { PoblacionBtsDto } from '../bts/bts.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ServicioOperacionesDto } from './dto/servicio-operaciones.dto.js';

type Configuracion = Omit<
  ServicioOperacionesDto,
  'nombre' | 'pausado' | 'expresionCron'
>;
const claveTramo = ({
  origenId,
  destinoId,
}: {
  origenId: string;
  destinoId: string;
}) => JSON.stringify([origenId, destinoId]);

const operacion = { entidadDestino: 'otp_metrics' as const, archivadoEn: null };

@Injectable()
export class ServiciosOperacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oag: OagService,
    private readonly bts: BtsService,
    private readonly configOag: ConfiguracionOag,
  ) {}

  private presentar<T extends { id: string; conexion: unknown }>(servicio: T) {
    const { conexion, ...datos } = servicio;
    const {
      proveedor = 'OAG',
      periodo,
      origenId,
      destinoId,
      coberturaMinimaPct,
      tramos,
    } = conexion as Configuracion;
    return {
      ...datos,
      operacion: {
        proveedor,
        periodo,
        origenId,
        destinoId,
        coberturaMinimaPct,
        tramos,
        programable: servicio.id === PROCESO_OAG_ID,
      },
    };
  }

  async listar() {
    const servicios = await this.prisma.models.ProcesoEtl.where(operacion)
      .orderBy((p) => p.creadoEn.desc())
      .limit(1000)
      .all();
    return servicios.map((servicio) => this.presentar(servicio));
  }

  private buscar(id: string) {
    return this.prisma.models.ProcesoEtl.first({ id, ...operacion });
  }

  async detalle(id: string) {
    const servicio = await this.buscar(id);
    return servicio && this.presentar(servicio);
  }

  async guardar(dto: ServicioOperacionesDto, id?: string) {
    const { nombre, pausado, tramos, expresionCron, ...config } = dto;
    if (expresionCron != null && id !== PROCESO_OAG_ID)
      throw new BadRequestException(
        'La programación se configura en el servicio mensual del sistema',
      );
    const conexion = {
      ...config,
      ...(tramos && { tramos: tramos.map((tramo) => ({ ...tramo })) }),
    };
    if (!nombre.trim())
      throw new BadRequestException('Indicá el nombre del servicio');
    if (conexion.periodo >= new Date().toISOString().slice(0, 7))
      throw new BadRequestException('Seleccioná un mes finalizado');

    if (conexion.proveedor === 'OAG') {
      await this.alcancesOag(conexion);
    } else if (
      conexion.origenId ||
      conexion.destinoId ||
      conexion.coberturaMinimaPct ||
      conexion.tramos
    ) {
      throw new BadRequestException('BTS admite el mes completo');
    }
    const datos = {
      nombre: nombre.trim(),
      conexion,
      pausado: pausado ?? true,
    };
    if (!id) {
      return this.presentar(
        await this.prisma.models.ProcesoEtl.create({
          ...datos,
          entidadDestino: 'otp_metrics',
          nombreConjunto: 'Operaciones de vuelos',
          mapeoEsquema: [],
          configuracionProgramacion: {},
        }),
      );
    }
    const actual = await this.buscar(id);
    if (!actual)
      throw new NotFoundException('Servicio de operaciones no encontrado');
    if (actual.esSistema && conexion.proveedor !== 'OAG')
      throw new BadRequestException(
        'El servicio OAG del sistema conserva su proveedor',
      );
    const row =
      id === PROCESO_OAG_ID
        ? await this.configOag.actualizarProceso(datos, expresionCron)
        : await this.prisma.models.ProcesoEtl.where({
            id,
            ...operacion,
          }).update(datos);
    if (!row)
      throw new NotFoundException('Servicio de operaciones no encontrado');
    return this.presentar(row);
  }

  async pausar(id: string, pausado: boolean) {
    const row =
      id === PROCESO_OAG_ID
        ? await this.configOag.actualizarProceso({ pausado })
        : await this.prisma.models.ProcesoEtl.where({
            id,
            ...operacion,
          }).update({ pausado });
    return row && this.presentar(row);
  }

  async archivar(id: string) {
    const servicio = await this.buscar(id);
    if (!servicio) return null;
    if (servicio.esSistema)
      throw new BadRequestException(
        'Los servicios del sistema no pueden archivarse',
      );
    const row = await this.prisma.models.ProcesoEtl.where({
      id,
      ...operacion,
    }).update({
      pausado: true,
      archivadoEn: new Date().toISOString().slice(0, -1).replace('T', ' '),
    });
    if (!row)
      throw new NotFoundException('Servicio de operaciones no encontrado');
    return this.presentar(row);
  }

  async cambiosDisponibles(id: string, pagina: number, limite: number) {
    const servicio = await this.detalle(id);
    if (!servicio)
      throw new NotFoundException('Servicio de operaciones no encontrado');
    const { proveedor, periodo, tramos, origenId, destinoId } =
      servicio.operacion;
    if (!periodo) return [];
    const tramosOag =
      tramos ?? (origenId && destinoId ? [{ origenId, destinoId }] : []);
    let metricas = this.prisma.models.MetricaRuta.where({
      periodo: periodo + '-01',
    }).where((m) =>
      or(
        m.ejecucionEtl.some((e) => not(e.fuente.eq(proveedor))),
        and(
          m.ejecucionEtlId.isNull(),
          m.actualizadoEn.isNotNull(),
          m.vuelosTotales.gt(0),
          not(m.fuentes.eq(['Administrativa'])),
          not(m.fuentes.eq([proveedor])),
        ),
      ),
    );
    if (proveedor === 'OAG') {
      if (!tramosOag.length) return [];
      metricas = metricas.where((m) =>
        or(
          ...tramosOag.map((tramo) =>
            and(m.origenId.eq(tramo.origenId), m.destinoId.eq(tramo.destinoId)),
          ),
        ),
      );
    }
    return metricas
      .select('origenId', 'destinoId', 'aerolineaId', 'fuentes')
      .include('origen', (a) => a.select('nombre', 'iata'))
      .include('destino', (a) => a.select('nombre', 'iata'))
      .include('aerolinea', (a) => a.select('nombre'))
      .include('ejecucionEtl', (e) => e.select('fuente'))
      .orderBy([
        (m) => m.origenId.asc(),
        (m) => m.destinoId.asc(),
        (m) => m.aerolineaId.asc(),
      ])
      .offset((pagina - 1) * limite)
      .limit(limite)
      .all();
  }

  async ejecutar(
    id: string,
    solicitanteId: string,
    autorizadas: PoblacionBtsDto[],
  ) {
    const servicio = await this.buscar(id);
    if (!servicio) return null;
    if (servicio.pausado) throw new ConflictException('Servicio pausado');
    const { operacion: config } = this.presentar(servicio);
    const referencia = { id, actualizadoEn: servicio.actualizadoEn };
    switch (config.proveedor) {
      case 'OAG': {
        const alcances = await this.alcancesOag(config);
        const tramos = new Map(
          alcances.map((tramo) => [
            claveTramo(tramo),
            {
              ...tramo,
              autorizarCambioFuente: [] as string[],
            },
          ]),
        );
        for (const autorizada of autorizadas) {
          const tramo = tramos.get(claveTramo(autorizada));
          if (!tramo)
            throw new BadRequestException(
              'La autorización debe corresponder a un tramo configurado',
            );
          tramo.autorizarCambioFuente.push(autorizada.aerolineaId);
        }
        const [principal, ...otrosTramos] = tramos.values();
        return this.oag.ejecutar(
          solicitanteId,
          { ...principal, otrosTramos },
          undefined,
          principal.autorizarCambioFuente,
          referencia,
        );
      }
      case 'BTS':
        return this.bts.ejecutar(
          config.periodo,
          solicitanteId,
          true,
          autorizadas,
          referencia,
        );
      default:
        throw new BadRequestException('Proveedor de operaciones inválido');
    }
  }

  async reintentar(job: { id: string; fuente: string }, solicitanteId: string) {
    if (job.fuente === 'OAG') return this.oag.reintentar(job.id, solicitanteId);
    if (job.fuente === 'BTS') return this.bts.reintentar(job.id, solicitanteId);
    return null;
  }

  private alcancesOag(config: Configuracion) {
    const { origenId, destinoId, periodo, coberturaMinimaPct = 90 } = config;
    const tramos =
      config.tramos ?? (origenId && destinoId ? [{ origenId, destinoId }] : []);
    if (!tramos.length)
      throw new BadRequestException('Seleccioná al menos un tramo');
    if (new Set(tramos.map(claveTramo)).size !== tramos.length)
      throw new BadRequestException('Los tramos deben ser distintos');
    return Promise.all(
      tramos.map((tramo) =>
        this.configOag.resolverAlcance({
          ...tramo,
          periodo,
          coberturaMinimaPct,
        }),
      ),
    );
  }
}
