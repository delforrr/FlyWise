import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { guardarObservaciones } from './observaciones.store.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Transaction } from '../prisma/db.js';
import { MetricsService } from '../metrics/metrics.service.js';
import type {
  ConsultaVuelosDto,
  EditarVueloDto,
  OperacionDto,
} from './dto/vuelo.dto.js';
import {
  validarOperacion,
  type ObservacionVuelo,
  type Operacion,
} from './operacion.js';

type CambiosVuelo = Partial<Operacion> & {
  protegidoManualmente?: boolean;
  archivadoEn?: string | null;
};

@Injectable()
export class VuelosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async listar(consulta: ConsultaVuelosDto) {
    let query = this.prisma.models.Vuelo;
    if (consulta.archivo === 'vigentes')
      query = query.where({ archivadoEn: null });
    if (consulta.archivo === 'archivados')
      query = query.where((v) => v.archivadoEn.isNotNull());
    if (consulta.periodo) {
      const inicio = consulta.periodo + '-01';
      const fin = new Date(inicio);
      fin.setUTCMonth(fin.getUTCMonth() + 1, 0);
      query = query
        .where((v) => v.fechaVuelo.gte(inicio))
        .where((v) => v.fechaVuelo.lte(fin.toISOString().slice(0, 10)));
    }
    if (consulta.origenId) query = query.where({ origenId: consulta.origenId });
    if (consulta.destinoId)
      query = query.where({ destinoId: consulta.destinoId });
    if (consulta.aerolineaId)
      query = query.where({ aerolineaId: consulta.aerolineaId });
    if (consulta.resultado) query = query.where({ estado: consulta.resultado });
    if (consulta.fuente) query = query.where({ fuente: consulta.fuente });
    const [datos, resumen] = await Promise.all([
      query
        .include('origen', (a) => a.select('id', 'nombre', 'iata'))
        .include('destino', (a) => a.select('id', 'nombre', 'iata'))
        .include('aerolinea', (a) => a.select('id', 'nombre', 'iata'))
        .orderBy([(v) => v.fechaVuelo.desc(), (v) => v.id.asc()])
        .offset((consulta.pagina - 1) * consulta.limite)
        .limit(consulta.limite)
        .all(),
      query.aggregate((v) => ({ total: v.count() })),
    ]);
    return {
      datos,
      total: Number(resumen.total),
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  async detalle(id: string) {
    const vuelo = await this.prisma.models.Vuelo.include('origen', (a) =>
      a.select('id', 'nombre', 'iata'),
    )
      .include('destino', (a) => a.select('id', 'nombre', 'iata'))
      .include('aerolinea', (a) => a.select('id', 'nombre', 'iata'))
      .first({ id });
    if (!vuelo) throw new NotFoundException('La operación no existe');
    return vuelo;
  }

  async historial(id: string, pagina = 1, limite = 20) {
    await this.detalle(id);
    const query = this.prisma.models.HistorialVuelo.where({ vueloId: id });
    const [datos, total] = await Promise.all([
      query
        .orderBy((h) => h.version.desc())
        .offset((pagina - 1) * limite)
        .limit(limite)
        .all(),
      query.aggregate((h) => ({ total: h.count() })),
    ]);
    return { datos, total: Number(total.total), pagina, limite };
  }

  crear(datos: OperacionDto, actorId: string) {
    const operacion = this.validar(datos);
    return this.prisma.db.transaction(async (tx) => {
      await this.metrics.bloquearCambios(tx);
      await this.validarReferencias(tx, operacion);
      const vuelo = await tx.orm.public.Vuelo.create({
        ...operacion,
        fuente: 'Administrativa',
        idRegistroFuente: randomUUID(),
        ejecucionEtlId: null,
        protegidoManualmente: true,
      });
      await this.auditar(tx, vuelo, 'crear', actorId);
      await this.metrics.marcarPendiente(tx, operacion);
      return vuelo;
    });
  }

  editar(id: string, datos: EditarVueloDto, actorId: string) {
    return this.cambiar(
      id,
      datos.version,
      actorId,
      'editar',
      async (tx, actual) => {
        if (actual.archivadoEn)
          throw new ConflictException(
            'Restaure la operación antes de editarla',
          );
        const operacion = this.validar({ ...actual, ...datos });
        await this.validarReferencias(tx, operacion);
        return { ...operacion, protegidoManualmente: true };
      },
    );
  }

  archivar(id: string, version: number, actorId: string) {
    return this.cambiar(id, version, actorId, 'archivar', () => ({
      archivadoEn: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      protegidoManualmente: true,
    }));
  }

  restaurar(id: string, version: number, actorId: string) {
    return this.cambiar(id, version, actorId, 'restaurar', () => ({
      archivadoEn: null,
      protegidoManualmente: true,
    }));
  }

  restablecerFuente(id: string, version: number, actorId: string) {
    return this.cambiar(
      id,
      version,
      actorId,
      'restablecer-fuente',
      async (tx, actual) => {
        if (actual.archivadoEn)
          throw new ConflictException(
            'Restaure la operación antes de volver a la fuente',
          );
        if (!actual.ultimaObservacion)
          throw new BadRequestException(
            'La operación manual no tiene observación de fuente',
          );
        const operacion = this.validar(
          actual.ultimaObservacion as unknown as Operacion,
        );
        await this.validarReferencias(tx, operacion);
        return { ...operacion, protegidoManualmente: false };
      },
    );
  }

  // The caller may pass its publication transaction so a complete coverage becomes visible together.
  async importarLote(
    observaciones: ObservacionVuelo[],
    ejecucionEtlId: string,
    transaccion?: Transaction,
  ) {
    if (observaciones.length > 5000)
      throw new BadRequestException(
        'El lote no puede superar 5000 operaciones',
      );
    const identidades = new Set<string>();
    for (const observacion of observaciones) {
      this.validar(observacion);
      if (!observacion.fuente.trim() || !observacion.idRegistroFuente.trim())
        throw new BadRequestException('Identidad de fuente requerida');
      const clave = JSON.stringify([
        observacion.fuente,
        observacion.idRegistroFuente,
      ]);
      if (identidades.has(clave))
        throw new ConflictException(
          'Identidad de operación duplicada dentro del lote',
        );
      identidades.add(clave);
    }
    const importar = async (tx: Transaction) => {
      await this.metrics.bloquearCambios(tx);
      return guardarObservaciones(tx, observaciones, ejecucionEtlId);
    };
    return transaccion
      ? importar(transaccion)
      : this.prisma.db.transaction(importar);
  }

  private validar(datos: OperacionDto) {
    try {
      return validarOperacion(datos);
    } catch (error) {
      if (error instanceof RangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async validarReferencias(tx: Transaction, operacion: Operacion) {
    const [origen, destino, aerolinea] = await Promise.all([
      tx.orm.public.Aeropuerto.first({
        id: operacion.origenId,
        archivadoEn: null,
      }),
      tx.orm.public.Aeropuerto.first({
        id: operacion.destinoId,
        archivadoEn: null,
      }),
      tx.orm.public.Aerolinea.first({
        id: operacion.aerolineaId,
        archivadoEn: null,
      }),
    ]);
    if (!origen || !destino || !aerolinea)
      throw new BadRequestException(
        'Los aeropuertos y la aerolínea deben existir y estar vigentes',
      );
  }

  private async auditar(
    tx: Transaction,
    vuelo: { id: string; version: number },
    accion: string,
    actorId: string | null,
  ) {
    await tx.orm.public.HistorialVuelo.create({
      vueloId: vuelo.id,
      version: vuelo.version,
      accion,
      actorId,
      instantanea: JSON.parse(JSON.stringify(vuelo)) as Record<
        string,
        string | number | boolean | null
      >,
    });
  }

  private cambiar(
    id: string,
    version: number,
    actorId: string,
    accion: string,
    cambios: (
      tx: Transaction,
      actual: Omit<
        Awaited<ReturnType<VuelosService['detalle']>>,
        'origen' | 'destino' | 'aerolinea'
      >,
    ) => CambiosVuelo | Promise<CambiosVuelo>,
  ) {
    return this.prisma.db.transaction(async (tx) => {
      await this.metrics.bloquearCambios(tx);
      const actual = await tx.orm.public.Vuelo.first({ id });
      if (!actual) throw new NotFoundException('La operación no existe');
      if (actual.version !== version)
        throw new ConflictException('La operación cambió; vuelva a cargarla');
      await tx.orm.public.Vuelo.where({ id, version }).update({
        ...(await cambios(tx, actual)),
        version: version + 1,
      });
      const actualizado = await tx.orm.public.Vuelo.firstOrThrow({ id });
      await this.auditar(tx, actualizado, accion, actorId);
      await this.metrics.marcarPendiente(tx, actual);
      await this.metrics.marcarPendiente(tx, actualizado);
      return actualizado;
    });
  }
}
