import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'node:fs';
import csv from 'csv-parser';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(
    @InjectQueue('etl-queue') private readonly etlQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async triggerJob(dataset: string) {
    const jobRecord = await this.prisma.etlJob.create({
      data: {
        source: dataset,
        status: 'pending',
      },
    });

    const job = await this.etlQueue.add(
      'process-dataset',
      {
        jobId: jobRecord.id,
        dataset,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return {
      message: `Job ${dataset} encolado exitosamente`,
      jobId: jobRecord.id,
      bullJobId: job.id,
    };
  }

  async getStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.etlQueue.getWaitingCount(),
      this.etlQueue.getActiveCount(),
      this.etlQueue.getCompletedCount(),
      this.etlQueue.getFailedCount(),
    ]);

    return {
      queue: 'etl-queue',
      counts: {
        waiting,
        active,
        completed,
        failed,
      },
    };
  }

  getHistory() {
    return this.prisma.etlJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Procesa países por streams con for-await (RNF-04)
   */
  async processCountries(
    filePath: string,
  ): Promise<{ total: number; inserted: number }> {
    let total = 0;
    const batch: Array<{
      name: string;
      isoCode: string | null;
      dafifCode: string | null;
    }> = [];

    const stream = fs.createReadStream(filePath).pipe(csv({ headers: false }));

    for await (const chunk of stream) {
      const row = chunk as Record<string, string>;
      total++;
      const name = row['0']?.trim();
      const isoCode = row['1']?.trim() || null;
      const dafifCode = row['2']?.trim() || null;

      if (name && name !== String.raw`\N`) {
        batch.push({ name, isoCode, dafifCode });
      }
    }

    if (batch.length > 0) {
      await this.prisma.country.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    return { total, inserted: batch.length };
  }

  /**
   * Procesa aeropuertos por streams en lotes de 2.000 filas (RNF-04)
   * Filtra aeropuertos comerciales con código IATA válido.
   */
  async processAirports(
    filePath: string,
  ): Promise<{ total: number; inserted: number; discarded: number }> {
    let total = 0;
    let inserted = 0;
    let discarded = 0;
    let batch: Array<{
      openflightsId: number | null;
      name: string;
      city: string | null;
      countryName: string;
      iata: string | null;
      icao: string | null;
      latitude: number;
      longitude: number;
      altitudeFt: number | null;
      timezoneOffset: number | null;
      dst: string | null;
      tzDatabase: string | null;
      type: string;
      source: string;
    }> = [];
    const BATCH_SIZE = 2000;

    const stream = fs.createReadStream(filePath).pipe(csv({ headers: false }));

    for await (const chunk of stream) {
      const row = chunk as Record<string, string>;
      total++;
      const openflightsId = Number.parseInt(row['0'], 10);
      const name = row['1']?.trim();
      const city =
        row['2']?.trim() === String.raw`\N` ? null : row['2']?.trim();
      const countryName = row['3']?.trim();
      const iataRaw = row['4']?.trim();
      const icaoRaw = row['5']?.trim();
      const lat = Number.parseFloat(row['6']);
      const lng = Number.parseFloat(row['7']);
      const alt = Number.parseInt(row['8'], 10);
      const tzOffset = Number.parseFloat(row['9']);
      const dst =
        row['10']?.trim() === String.raw`\N` ? null : row['10']?.trim();
      const tzDb =
        row['11']?.trim() === String.raw`\N` ? null : row['11']?.trim();
      const type = row['12']?.trim() || 'airport';
      const source = row['13']?.trim() || 'OpenFlights';

      const iata =
        iataRaw && iataRaw !== String.raw`\N` && iataRaw.length === 3
          ? iataRaw.toUpperCase()
          : null;
      const icao =
        icaoRaw && icaoRaw !== String.raw`\N` ? icaoRaw.toUpperCase() : null;

      // Filtro anti-saturación: descartar sin IATA comercial o coordenadas inválidas
      if (!name || Number.isNaN(lat) || Number.isNaN(lng) || !iata) {
        discarded++;
        continue;
      }

      batch.push({
        openflightsId: Number.isNaN(openflightsId) ? null : openflightsId,
        name,
        city,
        countryName: countryName || 'Unknown',
        iata,
        icao,
        latitude: lat,
        longitude: lng,
        altitudeFt: Number.isNaN(alt) ? null : alt,
        timezoneOffset: Number.isNaN(tzOffset) ? null : tzOffset,
        dst,
        tzDatabase: tzDb,
        type,
        source,
      });

      if (batch.length >= BATCH_SIZE) {
        const toInsert = [...batch];
        batch = [];
        await this.prisma.airport.createMany({
          data: toInsert,
          skipDuplicates: true,
        });
        inserted += toInsert.length;
      }
    }

    if (batch.length > 0) {
      await this.prisma.airport.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
    }

    return { total, inserted, discarded };
  }

  /**
   * Procesa aerolíneas por streams en lotes de 2.000 filas (RNF-04)
   * Filtra aerolíneas activas.
   */
  async processAirlines(
    filePath: string,
  ): Promise<{ total: number; inserted: number; discarded: number }> {
    let total = 0;
    let inserted = 0;
    let discarded = 0;
    let batch: Array<{
      openflightsId: number | null;
      name: string;
      alias: string | null;
      iata: string | null;
      icao: string | null;
      callsign: string | null;
      country: string | null;
      active: boolean;
    }> = [];
    const BATCH_SIZE = 2000;

    const stream = fs.createReadStream(filePath).pipe(csv({ headers: false }));

    for await (const chunk of stream) {
      const row = chunk as Record<string, string>;
      total++;
      const openflightsId = Number.parseInt(row['0'], 10);
      const name = row['1']?.trim();
      const alias =
        row['2']?.trim() === String.raw`\N` ? null : row['2']?.trim();
      const iataRaw = row['3']?.trim();
      const icaoRaw = row['4']?.trim();
      const callsign = row['5']?.trim() === '\\N' ? null : row['5']?.trim();
      const country =
        row['6']?.trim() === String.raw`\N` ? null : row['6']?.trim();
      const active = row['7']?.trim() === 'Y';

      const iata =
        iataRaw && iataRaw !== '\\N' && iataRaw !== '-'
          ? iataRaw.toUpperCase()
          : null;
      const icao =
        icaoRaw && icaoRaw !== String.raw`\N` ? icaoRaw.toUpperCase() : null;

      // Filtro: solo aerolíneas activas con nombre válido
      if (!name || !active) {
        discarded++;
        continue;
      }

      batch.push({
        openflightsId: isNaN(openflightsId) ? null : openflightsId,
        name,
        alias,
        iata,
        icao,
        callsign,
        country,
        active,
      });

      if (batch.length >= BATCH_SIZE) {
        const toInsert = [...batch];
        batch = [];
        await this.prisma.airline.createMany({
          data: toInsert,
          skipDuplicates: true,
        });
        inserted += toInsert.length;
      }
    }

    if (batch.length > 0) {
      await this.prisma.airline.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
    }

    return { total, inserted, discarded };
  }

  /**
   * Calcula popularidad de rutas e identifica el Top 100 anti-saturación
   */
  async computeRoutePopularityAndTop100() {
    this.logger.log(
      'Calculando conteo de rutas por aeropuerto y popularidad...',
    );

    // 1. Actualizar route_count en aeropuertos
    await this.prisma.$executeRaw`
      UPDATE airports a
      SET route_count = (
        SELECT COUNT(*) FROM routes r
        WHERE r.origin_id = a.id OR r.destination_id = a.id
      );
    `;

    // 2. Calcular PopularityScore en rutas:
    // Popularity = (operadores * 2) + log10(max(1, origin_routes * dest_routes))
    await this.prisma.$executeRaw`
      WITH route_weights AS (
        SELECT 
          r.id,
          (
            COALESCE(
              (SELECT COUNT(*) FROM routes dup 
               WHERE dup.origin_id = r.origin_id AND dup.destination_id = r.destination_id), 1
            ) * 2
          ) + 
          LOG(GREATEST(1, COALESCE(orig.route_count, 1) * COALESCE(dest.route_count, 1))) as score
        FROM routes r
        JOIN airports orig ON r.origin_id = orig.id
        JOIN airports dest ON r.destination_id = dest.id
      )
      UPDATE routes
      SET popularity_score = rw.score
      FROM route_weights rw
      WHERE routes.id = rw.id;
    `;

    // 3. Resetear is_top_100 y marcar las 100 con mayor popularidad
    await this.prisma.$executeRaw`UPDATE routes SET is_top_100 = false;`;

    await this.prisma.$executeRaw`
      WITH top100 AS (
        SELECT DISTINCT ON (origin_iata, destination_iata) id
        FROM routes
        ORDER BY origin_iata, destination_iata, popularity_score DESC
        LIMIT 100
      )
      UPDATE routes
      SET is_top_100 = true
      WHERE id IN (SELECT id FROM top100);
    `;

    this.logger.log(
      'Top 100 rutas y scores de popularidad actualizados exitosamente.',
    );
  }
}
