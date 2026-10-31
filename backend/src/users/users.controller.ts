import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { type UserDto } from './dto/user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';

@ApiTags('Usuarios')
@ApiResponse({ status: 403, description: 'Se requiere el rol ADMIN' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtiene el listado completo de usuarios registrados',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los usuarios registrados en el sistema',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT no provisto o expirado',
  })
  async getUsers(): Promise<UserDto[]> {
    return this.userService.getUsers();
  }

  @Get('/:id')
  @ApiOperation({
    summary: 'Obtiene el detalle de un usuario por su identificador UUID',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Identificador único del usuario (UUID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del usuario solicitado',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT no provisto o expirado',
  })
  async getUserById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserDto> {
    return this.userService.getUserById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un nuevo usuario de forma administrativa' })
  @ApiBody({
    type: CreateUserDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: ya existe un usuario con el correo provisto',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT no provisto o expirado',
  })
  async postUser(@Body() createUserDto: CreateUserDto): Promise<UserDto> {
    return this.userService.createUser(createUserDto);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Actualiza los datos de un usuario existente' })
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Identificador único del usuario (UUID)',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT no provisto o expirado',
  })
  async putUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un usuario del sistema' })
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Identificador único del usuario (UUID)',
  })
  @ApiResponse({
    status: 204,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT no provisto o expirado',
  })
  async deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.userService.deleteUser(id);
  }
}
