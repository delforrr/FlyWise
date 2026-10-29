import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Disponibilidad')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Devuelve un texto de comprobación' })
  getHello(): string {
    return this.appService.getHello();
  }
}
