import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { BtsService } from './bts.service.js';
import {
  ConfiguracionBtsDto,
  ConsultaBtsDto,
  ConsultaDescartesBtsDto,
  CorrespondenciaBtsDto,
  EjecucionBtsParams,
} from './bts.dto.js';

@ApiTags('BTS mensual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/bts')
export class BtsController {
  constructor(private readonly bts: BtsService) {}
  @Get('configuracion') configuracion() {
    return this.bts.configuracion();
  }
  @Patch('configuracion') configurar(@Body() dto: ConfiguracionBtsDto) {
    return this.bts.configurar(dto);
  }
  @Post('ejecutar') ejecutar(@Req() req: { user: { id?: string } }) {
    return this.bts.ejecutar(undefined, req.user.id);
  }
  @Get('cobertura') cobertura() {
    return this.bts.cobertura();
  }
  @Get('correspondencias') pendientes(@Query() dto: ConsultaBtsDto) {
    return this.bts.pendientes(dto);
  }
  @Patch('correspondencias') resolver(@Body() dto: CorrespondenciaBtsDto) {
    return this.bts.resolver(dto);
  }
  @Get('ejecuciones') ejecuciones() {
    return this.bts.ejecuciones();
  }
  @Get('ejecuciones/:id/descartes') descartes(
    @Param() params: EjecucionBtsParams,
    @Query() query: ConsultaDescartesBtsDto,
  ) {
    return this.bts.descartes(params.id, query.intento);
  }
  @Post('ejecuciones/:id/reintentar') reintentar(
    @Param() params: EjecucionBtsParams,
    @Req() req: { user: { id?: string } },
  ) {
    return this.bts.reintentar(params.id, req.user.id);
  }
}
