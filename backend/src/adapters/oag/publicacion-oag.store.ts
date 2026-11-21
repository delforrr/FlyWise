import { not } from '@prisma/orm-postgres/orm-client';
import { ultimoDiaDelMes } from '../../prisma/timestamp.js';
import { admiteFuente } from '../../metrics/domain/autoridad-publicacion.js';
import {
  bloquearCambiosMetricas,
  leerPublicacionesDelTramo,
} from '../../metrics/publicacion.store.js';
import { publicarPoblacionesCandidatas } from '../../metrics/poblaciones-candidatas.store.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Transaction } from '../../prisma/db.js';
import { guardarObservaciones } from '../../vuelos/observaciones.store.js';
import {
  alcanceDe,
  FalloOag,
  type Codigos,
  type AlcanceOag,
  type ProgresoOag,
  type TramoLeido,
  type TramoOag,
} from '../../ingestion/application/oag/alcance-oag.js';
import type { RepositorioCargaOag } from '../../ingestion/application/oag/cargar-oag.js';

const fuente = 'OAG';
const LOTE = 1000;
const ahora = () => new Date().toISOString().replace('T', ' ').replace('Z', '');

@Injectable()
export class PublicacionOagStore implements RepositorioCargaOag {
  constructor(private readonly prisma: PrismaService) {}

  guardar(
    id: string,
    intento: number,
    preparados: TramoLeido[],
    progreso: ProgresoOag,
  ) {
    return this.prisma.db.transaction(async (tx) => {
      await bloquearCambiosMetricas(tx);
      const activa = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
        estado: 'running',
        listaParaPublicar: false,
      })
        .select('id')
        .forUpdate()
        .first();
      if (!activa) return;
      let insertadas = 0;
      let procesadas = 0;
      for (const preparada of preparados) {
        if (
          !preparada.observaciones.length ||
          !(await this.validarReemplazo(tx, preparada))
        )
          continue;
        procesadas += preparada.observaciones.length;
        for (
          let inicio = 0;
          inicio < preparada.observaciones.length;
          inicio += LOTE
        ) {
          const lote = await guardarObservaciones(
            tx,
            preparada.observaciones.slice(inicio, inicio + LOTE),
            id,
          );
          insertadas += lote.insertadas;
        }
      }
      progreso.descartadas = progreso.total - procesadas;
      await tx.orm.public.EjecucionEtl.where({ id, intento }).update({
        listaParaPublicar: true,
        filasTotales: progreso.total,
        filasProcesadas: procesadas,
        filasDescartadas: progreso.descartadas,
        filasInsertadas: insertadas,
      });
    });
  }

  async hayPublicacionPosterior(
    tx: Transaction,
    alcance: TramoOag,
    iniciadoEn: string,
  ) {
    await bloquearCambiosMetricas(tx);
    const publicaciones = await leerPublicacionesDelTramo(tx, alcance);
    return publicaciones.some(
      (actual) =>
        actual.incluyeOag &&
        actual.actualizadoEn !== null &&
        actual.actualizadoEn > iniciadoEn,
    );
  }

  private async validarReemplazo(
    tx: Transaction,
    { alcance, observaciones, totalesPorOperadora }: TramoLeido,
  ) {
    const autoridades = await leerPublicacionesDelTramo(tx, alcance);
    const perdioCobertura = autoridades.some(
      (actual) =>
        actual.incluyeOag &&
        (totalesPorOperadora[actual.aerolineaId] ?? 0) < actual.vuelosTotales,
    );
    if (
      perdioCobertura ||
      (await this.faltaObservacionAnterior(
        tx,
        alcance,
        observaciones.map((vuelo) => vuelo.idRegistroFuente),
        autoridades,
      ))
    ) {
      return false;
    }
    const autorizadas = new Set(alcance.autorizarCambioFuente);
    if (
      autoridades.some(
        (actual) =>
          totalesPorOperadora[actual.aerolineaId] > 0 &&
          !admiteFuente(actual, fuente, autorizadas.has(actual.aerolineaId)),
      )
    ) {
      throw new FalloOag(
        'El cambio de fuente requiere autorización por operadora',
      );
    }
    return true;
  }

  async resolverAerolinea({ iata, icao }: Codigos): Promise<string | null> {
    if (iata && !/^[A-Z0-9]{2}$/.test(iata)) return null;
    if (icao && !/^[A-Z0-9]{3}$/.test(icao)) return null;
    if (!iata && !icao) return null;
    const aerolineas = this.prisma.models.Aerolinea;
    const ids: string[] = [];
    for (const [campo, codigo] of [
      ['iata', iata],
      ['icao', icao],
    ] as const) {
      if (!codigo) continue;
      const rows = await aerolineas
        .where({ [campo]: codigo, archivadoEn: null })
        .limit(2)
        .all();
      if (rows.length > 1) return null;
      if (rows[0]) ids.push(rows[0].id);
      else if (iata && icao) return null;
    }
    return ids.length && ids.every((id) => id === ids[0]) ? ids[0] : null;
  }

  private async faltaObservacionAnterior(
    tx: Transaction,
    { origenId, destinoId, periodo }: AlcanceOag,
    identidades: string[],
    autoridades: Awaited<ReturnType<typeof leerPublicacionesDelTramo>>,
  ) {
    const desde = periodo + '-01';
    const hasta = ultimoDiaDelMes(desde);
    for (const anterior of autoridades) {
      if (anterior.fuente !== fuente || !anterior.ejecucionId) continue;
      const vigentes = tx.orm.public.Vuelo.where({
        origenId,
        destinoId,
        fuente,
        archivadoEn: null,
        aerolineaId: anterior.aerolineaId,
        ejecucionEtlId: anterior.ejecucionId,
      })
        .where((v) => v.fechaVuelo.gte(desde))
        .where((v) => v.fechaVuelo.lte(hasta));
      const faltante = await vigentes
        .where((v) => not(v.idRegistroFuente.in(identidades)))
        .select('id')
        .first();
      if (faltante) return true;
    }
    return false;
  }

  publicar(id: string, intento: number) {
    return this.prisma.db.transaction(async (tx) => {
      await bloquearCambiosMetricas(tx);
      const registro = await tx.orm.public.EjecucionEtl.where({
        id,
        intento,
        estado: 'running',
        listaParaPublicar: true,
      })
        .forUpdate()
        .first();
      if (!registro) return;
      const alcance = alcanceDe(registro.instantaneaConfiguracion);
      if (!alcance?.periodo)
        throw new Error('Falta el alcance de publicación OAG');
      // FIXME(T12): exigir aprobación y verificar permisos antes de publicar datos reales.
      for (const tramo of [alcance, ...(alcance.otrosTramos ?? [])]) {
        const autorizadas = new Set(tramo.autorizarCambioFuente);
        await publicarPoblacionesCandidatas(
          tx,
          tramo.periodo,
          id,
          fuente,
          ({ aerolineaId }) => autorizadas.has(aerolineaId),
          tramo,
          { conservarAusentes: true },
        );
      }
      await tx.orm.public.EjecucionEtl.where({ id }).update({
        estado: 'completed',
        mensajeError: null,
        listaParaPublicar: false,
        finalizadoEn: ahora(),
      });
      await tx.orm.public.EventoEjecucionEtl.create({
        ejecucionId: id,
        intento,
        nivel: 'success',
        mensaje:
          registro.filasProcesadas === 0
            ? `OAG sin cobertura: ${registro.filasDescartadas} descartes`
            : `OAG publicado: ${registro.filasProcesadas} operaciones y ${registro.filasDescartadas} descartes`,
      });
    });
  }
}
