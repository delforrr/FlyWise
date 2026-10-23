import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AirportsModule } from './airports/airports.module';
import { CountriesModule } from './countries/countries.module';
import { AirlinesModule } from './airlines/airlines.module';
import { RoutesModule } from './routes/routes.module';
import { EtlModule } from './etl/etl.module';

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
