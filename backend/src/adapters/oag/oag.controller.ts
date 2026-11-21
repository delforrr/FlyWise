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
import { ConfiguracionOagDto, EjecutarOagDto } from './oag.dto.js';
import { JwtAuthGuard, AdminGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../users/decorators/current-user.decorator.js';
import type { UserDto } from '../../users/dto/user.dto.js';
import { ConfiguracionOag } from './configuracion-oag.js';
import { OagService } from './oag.service.js';

@ApiTags('OAG mensual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/oag')
export class OagController {
  constructor(
    private readonly oag: OagService,
    private readonly config: ConfiguracionOag,
  ) {}

  @Get('configuracion')
  configuracion() {
    return this.config.configuracion();
  }

  @Patch('configuracion')
  configurar(@Body() dto: ConfiguracionOagDto) {
    return this.config.configurar(dto);
  }

  @Post('ejecutar')
  ejecutar(@Body() dto: EjecutarOagDto, @CurrentUser() user: UserDto) {
    return this.oag.ejecutar(
      user.id,
      undefined,
      undefined,
      dto.autorizarCambioFuente,
    );
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
