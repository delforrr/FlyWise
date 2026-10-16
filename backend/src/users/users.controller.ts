import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { type UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
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
  getUsers(): UserDto[] {
    return this.userService.getUsers();
  }

  @Get('/:id')
  @ApiOperation({
    summary: 'Obtiene el detalle de un usuario por su identificador',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: 'Identificador único del usuario',
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
  getUserById(@Param('id', ParseIntPipe) id: number): UserDto {
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
  postUser(@Body() createUserDto: CreateUserDto): UserDto {
    return this.userService.createUser(createUserDto);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Actualiza los datos de un usuario existente' })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: 'Identificador único del usuario',
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
  putUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): UserDto | undefined {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un usuario del sistema' })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: 'Identificador único del usuario',
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
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    this.userService.deleteUser(id);
  }
}
