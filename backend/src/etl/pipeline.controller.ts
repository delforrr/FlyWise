import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { UserDto } from '../users/dto/user.dto.js';
import {
  CreatePipelineDto,
  PipelineConnectionDto,
  UpdatePipelineDto,
} from './dto/pipeline.dto.js';
import { PipelinesService } from './pipelines.service.js';
import { SampleQueryDto } from './dto/sample-query.dto.js';

@ApiTags('Cargas de datos')
@ApiResponse({ status: 403, description: 'Se requiere el rol ADMIN' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('etl')
export class PipelineController {
  constructor(private readonly service: PipelinesService) {}
  @Get('procesos')
  @ApiOperation({ summary: 'Lista configuraciones sin archivar' })
  list() {
    return this.service.list();
  }
  @Post('procesos')
  @ApiOperation({ summary: 'Crea una configuración de carga' })
  create(@Body() dto: CreatePipelineDto) {
    return this.service.create(dto);
  }
  @Post('procesos/probar')
  @ApiOperation({
    summary: 'Comprueba una conexión con hasta cinco filas',
    description:
      'Comprobar success en la respuesta, incluso con una respuesta HTTP exitosa.',
  })
  probe(@Body() dto: PipelineConnectionDto) {
    return this.service.probe(dto);
  }
  @Patch('procesos/:id')
  @ApiOperation({ summary: 'Actualiza una configuración de carga' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete('procesos/:id')
  @ApiOperation({
    summary: 'Archiva una configuración y conserva su historial',
  })
  archive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.archive(id);
  }
  @Post('procesos/:id/ejecutar')
  @ApiOperation({
    summary: 'Solicita una ejecución y devuelve su identificador',
  })
  run(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.run(id, user.id);
  }
  @Get('ejecuciones/:id')
  @ApiOperation({ summary: 'Consulta una ejecución' })
  job(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.job(id);
  }
  @Get('ejecuciones/:id/eventos')
  @ApiOperation({
    summary: 'Lista hasta 100 eventos, del más reciente al más antiguo',
  })
  eventos(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.eventos(id);
  }
  @Get('ejecuciones/:id/muestras')
  @ApiOperation({ summary: 'Lista hasta 100 muestras rechazadas por posición' })
  samples(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: SampleQueryDto,
  ) {
    return this.service.samples(id, query.intento);
  }
  @Post('ejecuciones/:id/reintentar')
  @ApiOperation({ summary: 'Crea una ejecución nueva desde el principio' })
  retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.retry(id, user.id);
  }
}
