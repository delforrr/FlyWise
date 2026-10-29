import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('Disponibilidad')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Consulta la disponibilidad general',
  })
  @ApiResponse({
    status: 200,
    description: 'Disponible.',
  })
  @ApiResponse({
    status: 503,
    description: 'Disponibilidad reducida.',
  })
  async check(@Res() res: Response) {
    let dbStatus = 'down';
    let redisStatus = 'down';

    try {
      await this.prisma.db.query(
        this.prisma.db.raw.sql`SELECT 1 AS ok`
          .returnsRow({ ok: 'pg/int4@1' })
          .build(),
      );
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    try {
      const pong = await this.redis.ping();
      redisStatus = pong === 'PONG' ? 'up' : 'down';
    } catch {
      redisStatus = 'down';
    }

    const isHealthy = dbStatus === 'up' && redisStatus === 'up';
    const statusCode = isHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  }
}
