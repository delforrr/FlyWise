import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsUUID, Matches, Max, Min } from 'class-validator';
import { JwtAuthGuard, AdminGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../users/decorators/current-user.decorator.js';
import type { UserDto } from '../../users/dto/user.dto.js';
import { OagService } from './oag.service.js';

export class ConfiguracionOagDto {
  @IsBoolean() pausado!: boolean;
  @IsUUID() origenId!: string;
  @IsUUID() destinoId!: string;
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;
  @IsInt() @Min(1) @Max(100) coberturaMinimaPct!: number;
}

class EjecutarOagDto {}

@ApiTags('OAG mensual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/oag')
export class OagController {
  constructor(private readonly oag: OagService) {}

  @Get('configuracion')
  configuracion() {
    return this.oag.configuracion();
  }

  @Patch('configuracion')
  configurar(@Body() dto: ConfiguracionOagDto) {
    return this.oag.configurar(dto);
  }

  @Post('ejecutar')
  ejecutar(@Body() _dto: EjecutarOagDto, @CurrentUser() user: UserDto) {
    return this.oag.ejecutar(user.id);
  }

  @Get('ejecuciones')
  ejecuciones() {
    return this.oag.ejecuciones();
  }

  @Post('ejecuciones/:id/reintentar')
  reintentar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.oag.reintentar(id, user.id);
  }
}
