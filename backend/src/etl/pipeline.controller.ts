import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  CrearServicioOperacionesDto,
  EjecutarServicioDto,
  ServicioOperacionesDto,
} from './dto/servicio-operaciones.dto.js';
import { ServiciosOperacionesService } from './servicios-operaciones.service.js';
import {
  Body,
  BadRequestException,
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
  PipelineIdDto,
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
  constructor(
    private readonly service: PipelinesService,
    private readonly operaciones: ServiciosOperacionesService,
  ) {}
  @Get('procesos')
  @ApiOperation({ summary: 'Lista configuraciones sin archivar' })
  async list() {
    const [catalogos, operaciones] = await Promise.all([
      this.service.list(),
      this.operaciones.listar(),
    ]);
    return [...operaciones, ...catalogos];
  }
  @Post('procesos/operaciones')
  crearOperacion(@Body() dto: CrearServicioOperacionesDto) {
    return this.operaciones.guardar(dto);
  }
  @Patch('procesos/operaciones/:id')
  editarOperacion(
    @Param() { id }: PipelineIdDto,
    @Body() dto: ServicioOperacionesDto,
  ) {
    return this.operaciones.guardar(dto, id);
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
  @Get('procesos/:id')
  @ApiOperation({ summary: 'Consulta la configuración de una carga' })
  async detail(@Param() params: PipelineIdDto) {
    return (
      (await this.operaciones.detalle(params.id)) ??
      this.service.find(params.id)
    );
  }
  @Patch('procesos/:id')
  @ApiOperation({ summary: 'Actualiza una configuración de carga' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    if (
      dto.pausado !== undefined &&
      Object.keys(dto).every((campo) => campo === 'pausado')
    ) {
      const actualizado = await this.operaciones.pausar(id, dto.pausado);
      if (actualizado) return actualizado;
    }
    return this.service.update(id, dto);
  }
  @Delete('procesos/:id')
  @ApiOperation({
    summary: 'Archiva una configuración y conserva su historial',
  })
  async archive(@Param('id', new ParseUUIDPipe()) id: string) {
    return (await this.operaciones.archivar(id)) ?? this.service.archive(id);
  }
  @Post('procesos/:id/ejecutar')
  @ApiOperation({
    summary: 'Solicita una ejecución y devuelve su identificador',
  })
  async run(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: EjecutarServicioDto,
  ) {
    const autorizadas = dto?.autorizarCambioFuente ?? [];
    const operacion = await this.operaciones.ejecutar(id, user.id, autorizadas);
    if (operacion) return operacion;
    if (autorizadas.length)
      throw new BadRequestException(
        'La autorización sólo corresponde a ingestas de operaciones',
      );
    return this.service.run(id, user.id);
  }
  @Get('procesos/:id/cambios-de-fuente')
  cambiosDeFuente(
    @Param() { id }: PipelineIdDto,
    @Query() consulta: ConsultaCatalogoDto,
  ) {
    return this.operaciones.cambiosDisponibles(
      id,
      consulta.pagina,
      consulta.limite,
    );
  }
  @Get('procesos/:id/historial')
  historialServicio(@Param() { id }: PipelineIdDto) {
    return this.service.getHistory(id);
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
  async retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    const job = await this.service.job(id);
    return (
      (await this.operaciones.reintentar(job, user.id)) ??
      this.service.retry(id, user.id)
    );
  }
}
