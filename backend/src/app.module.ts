import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AirportsModule } from './airports/airports.module.js';
import { CountriesModule } from './countries/countries.module.js';
import { AirlinesModule } from './airlines/airlines.module.js';
import { RoutesModule } from './routes/routes.module.js';
import { EtlModule } from './etl/etl.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AirportsModule,
    CountriesModule,
    AirlinesModule,
    RoutesModule,
    EtlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
