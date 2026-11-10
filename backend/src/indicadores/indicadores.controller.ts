import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { UserDto } from '../users/dto/user.dto.js';
import { EurocontrolService } from './eurocontrol.service.js';
import {
  ConsultaIndicadoresDto,
  ProductoEurocontrolDto,
  ProgramacionEurocontrolDto,
} from './indicadores.dto.js';
@ApiTags('Indicadores externos EUROCONTROL')
@ApiBearerAuth()
@ApiResponse({ status: 403, description: 'Se requiere ADMIN' })
@ApiResponse({
  status: 400,
  description: 'Filtro, producto o programación inválidos',
})
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/indicadores/eurocontrol')
export class IndicadoresController {
  constructor(private readonly service: EurocontrolService) {}
  @Get()
  @ApiOperation({
    summary:
      'Consulta indicadores nativos, contadores, metodología y aviso, sin recomposición de OTP FlyWise',
  })
  list(@Query() query: ConsultaIndicadoresDto) {
    return this.service.list(query);
  }
  @Get('fuentes')
  @ApiOperation({
    summary:
      'Consulta programación mensual UTC y última ejecución de ambos XLSX oficiales',
  })
  sources() {
    return this.service.sources();
  }
  @Get('instantaneas')
  @ApiOperation({
    summary: 'Lista snapshots completos para consultar revisiones históricas',
  })
  snapshots(@Query() query: ConsultaIndicadoresDto) {
    return this.service.snapshots(query);
  }
  @Patch('fuentes/:producto')
  @ApiOperation({ summary: 'Pausa o reanuda actualizaciones mensuales' })
  schedule(
    @Param() params: ProductoEurocontrolDto,
    @Body() dto: ProgramacionEurocontrolDto,
  ) {
    return this.service.schedule(params.producto, dto.pausado);
  }
  @Post('fuentes/:producto/ejecutar')
  @ApiOperation({
    summary:
      'Encola una descarga completa con hasta dos reintentos automáticos',
  })
  run(@Param() params: ProductoEurocontrolDto, @CurrentUser() user: UserDto) {
    return this.service.enqueue(params.producto, user.id);
  }
  @Post('ejecuciones/:id/reintentar')
  @ApiOperation({ summary: 'Solicita otra ejecución de una carga fallida' })
  retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.retry(id, user.id);
  }
}
