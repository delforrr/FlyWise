import { timestampToDate } from '../prisma/timestamp.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { User } from './interfaces/users.interface.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get users() {
    return this.prisma.models.User.select('id', 'email', 'role', 'createdAt');
  }

  public async getUsers(): Promise<UserDto[]> {
    const users = await this.users
      .orderBy((user) => user.createdAt.desc())
      .all();
    return users.map((user) => this.toDto(user));
  }

  public async getUserById(id: string): Promise<UserDto> {
    try {
      return this.toDto(await this.users.firstOrThrow({ id }));
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async getUserByEmail(email: string): Promise<UserDto> {
    try {
      return this.toDto(
        await this.users.firstOrThrow({ email: email.trim().toLowerCase() }),
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async createUser(userDto: CreateUserDto): Promise<UserDto> {
    const normalizedEmail = userDto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(userDto.password, 10);
    try {
      const created = await this.users.create({
        email: normalizedEmail,
        passwordHash,
        role: userDto.role ?? 'OPERATOR',
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
    const data: Partial<Pick<User, 'email' | 'passwordHash' | 'role'>> = {};
    if (updateData.email) data.email = updateData.email.trim().toLowerCase();
    if (updateData.password)
      data.passwordHash = await bcrypt.hash(updateData.password, 10);
    if (updateData.role) data.role = updateData.role;
    try {
      const updated = await this.users.where({ id }).update(data);
      if (!updated) throw new NotFoundException('El usuario no existe');
      this.logger.log(`Usuario con id ${id} actualizado`);
      return this.toDto(updated);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public async deleteUser(id: string): Promise<void> {
    try {
      const deleted = await this.prisma.models.User.where({ id }).delete();
      if (!deleted) throw new NotFoundException('El usuario no existe');
      this.logger.log(`Se eliminó el usuario con id ${id}`);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  public findByEmail(email: string): Promise<User | null> {
    return this.prisma.models.User.first({ email: email.trim().toLowerCase() });
  }

  private toDto(
    user: Pick<User, 'id' | 'email' | 'role' | 'createdAt'>,
  ): UserDto {
    return { ...user, createdAt: timestampToDate(user.createdAt) };
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
