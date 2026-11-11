import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { createDatabase } from './db.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnApplicationShutdown {
  readonly db = createDatabase();
  readonly models = this.db.orm.public;
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.db.connect();
    this.logger.log('Conectado a PostgreSQL (PostGIS) exitosamente.');
  }

  async onApplicationShutdown() {
    await this.db.close();
    this.logger.log('Desconectado de PostgreSQL.');
  }
}
