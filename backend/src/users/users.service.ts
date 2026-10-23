import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from './interfaces/users.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // CRUD
  public async getUsers(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    this.logger.log(`Se obtuvieron ${users.length} usuarios`);
    return users.map((usr) => this.mapToDto(usr));
  }

  public async getUserById(id: string): Promise<UserDto> {
    const foundUser = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!foundUser) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    this.logger.log(`Se obtuvo el usuario con id ${id}`);
    return this.mapToDto(foundUser);
  }

  public async getUserByEmail(email: string): Promise<UserDto> {
    const foundUser = await this.findByEmail(email);
    if (!foundUser) {
      throw new NotFoundException(`El correo ${email} no existe`);
    }
    this.logger.log(`Se obtuvo el usuario con mail ${email}`);
    return this.mapToDto(foundUser);
  }

  public async createUser(userDto: CreateUserDto): Promise<UserDto> {
    const normalizedEmail = userDto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('El usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(userDto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: userDto.role ?? 'OPERATOR',
      },
    });

    this.logger.log(`Se creo el usuario con id ${created.id}`);
    return this.mapToDto(created);
  }

  public async updateUser(
    id: string,
    updateData: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const dataToUpdate: {
      email?: string;
      passwordHash?: string;
      role?: 'ADMIN' | 'OPERATOR';
    } = {};

    if (updateData.email) {
      const normalizedEmail = updateData.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const emailTaken = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (emailTaken) {
          throw new ConflictException(
            'El correo ya está en uso por otra cuenta',
          );
        }
        dataToUpdate.email = normalizedEmail;
      }
    }

    if (updateData.password) {
      dataToUpdate.passwordHash = await bcrypt.hash(updateData.password, 10);
    }

    if (updateData.role) {
      dataToUpdate.role = updateData.role;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    this.logger.log(`Usuario con id ${id} actualizado`);
    return this.mapToDto(updated);
  }

  public async deleteUser(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('El usuario que se quiere borrar no existe');
    }

    await this.prisma.user.delete({ where: { id } });
    this.logger.log(`Se elimino el usuario con id ${id}`);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapToDto(user: {
    id: string;
    email: string;
    role: string;
    createdAt?: Date;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'OPERATOR',
      createdAt: user.createdAt,
    };
  }
}
