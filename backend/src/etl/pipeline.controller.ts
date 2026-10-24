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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { UserDto } from '../users/dto/user.dto.js';
import {
  CreatePipelineDto,
  PipelineConnectionDto,
  UpdatePipelineDto,
} from './dto/pipeline.dto.js';
import { PipelinesService } from './pipelines.service.js';

@ApiTags('etl')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('etl')
export class PipelineController {
  constructor(private readonly service: PipelinesService) {}
  @Get('pipelines') list() {
    return this.service.list();
  }
  @Post('pipelines') create(@Body() dto: CreatePipelineDto) {
    return this.service.create(dto);
  }
  @Post('pipelines/probe') probe(@Body() dto: PipelineConnectionDto) {
    return this.service.probe(dto);
  }
  @Patch('pipelines/:id') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete('pipelines/:id') archive(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.archive(id);
  }
  @Post('pipelines/:id/run') run(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.run(id, user.id);
  }
  @Get('jobs/:id') job(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.job(id);
  }
  @Get('jobs/:id/events') events(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.events(id);
  }
  @Get('jobs/:id/samples') samples(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.samples(id);
  }
  @Post('jobs/:id/retry') retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.retry(id, user.id);
  }
}
