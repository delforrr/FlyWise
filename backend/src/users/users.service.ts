import { timestampToDate } from '../prisma/timestamp.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { Usuario } from './interfaces/users.interface.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get usuarios() {
    return this.prisma.models.Usuario.select('id', 'correo', 'rol', 'creadoEn');
  }

  public async getUsers(): Promise<UserDto[]> {
    const usuarios = await this.usuarios
      .orderBy((user) => user.creadoEn.desc())
      .all();
    return usuarios.map((user) => this.toDto(user));
  }

  public async getUserById(id: string): Promise<UserDto> {
    try {
      return this.toDto(await this.usuarios.firstOrThrow({ id }));
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async getUserByEmail(correo: string): Promise<UserDto> {
    try {
      return this.toDto(
        await this.usuarios.firstOrThrow({
          correo: correo.trim().toLowerCase(),
        }),
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async createUser(userDto: CreateUserDto): Promise<UserDto> {
    const normalizedEmail = userDto.correo.trim().toLowerCase();
    const hashContrasena = await bcrypt.hash(userDto.password, 10);
    try {
      const created = await this.usuarios.create({
        correo: normalizedEmail,
        hashContrasena,
        rol: userDto.rol ?? 'OPERATOR',
      });
      this.logger.log(`Se creó el usuario con id ${created.id}`);
      return this.toDto(created);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async updateUser(
    id: string,
    updateData: UpdateUserDto,
  ): Promise<UserDto> {
    const data: Partial<Pick<Usuario, 'correo' | 'hashContrasena' | 'rol'>> =
      {};
    if (updateData.correo) data.correo = updateData.correo.trim().toLowerCase();
    if (updateData.password)
      data.hashContrasena = await bcrypt.hash(updateData.password, 10);
    if (updateData.rol) data.rol = updateData.rol;
    try {
      const updated = await this.usuarios.where({ id }).update(data);
      if (!updated) throw new NotFoundException('El usuario no existe');
      this.logger.log(`Usuario con id ${id} actualizado`);
      return this.toDto(updated);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      const deleted = await this.prisma.models.Usuario.where({ id }).delete();
      if (!deleted) throw new NotFoundException('El usuario no existe');
      this.logger.log(`Se eliminó el usuario con id ${id}`);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public findByEmail(correo: string): Promise<Usuario | null> {
    return this.prisma.models.Usuario.first({
      correo: correo.trim().toLowerCase(),
    });
  }

  private toDto(
    user: Pick<Usuario, 'id' | 'correo' | 'rol' | 'creadoEn'>,
  ): UserDto {
    return { ...user, creadoEn: timestampToDate(user.creadoEn) };
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof Error) {
      if ('sqlState' in error && error.sqlState === '23505') {
        throw new ConflictException('El correo ya está en uso');
      }
      if ('code' in error && error.code === 'RUNTIME.NO_ROWS') {
        throw new NotFoundException('El usuario no existe');
      }
    }
    throw error;
  }
}
