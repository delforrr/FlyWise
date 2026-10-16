import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from './interfaces/users.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly Users: User[] = [];
  private nextId = 1;

  // CRUD
  public getUsers(): UserDto[] {
    const users = this.Users;
    console.log(`Se obtuvieron ${this.Users.length} usuarios`);
    return users.map((usr) => this.mapToDto(usr));
  }

  public getUserById(id: number): UserDto {
    const foundUser = this.findById(id);
    console.log(`Se obtuvo el usuario con id ${id}`);
    return this.mapToDto(foundUser);
  }

  public getUserByEmail(email: string): UserDto {
    const foundUser = this.findByEmail(email);
    if (!foundUser) {
      throw new NotFoundException(` ${email} El mail no existe`);
    }
    console.log(`Se obtuvo el usuario con mail ${email}`);
    return this.mapToDto(foundUser);
  }

  public createUser(userDto: CreateUserDto): UserDto {
    this.validateEmailExists(userDto.email);
    const user = this.mapToDomain(userDto);
    this.Users.push(user);
    console.log(`Se creo el usuario con id ${user.id}`);
    return this.mapToDto(user);
  }

  public updateUser(id: number, updateData: UpdateUserDto): UserDto {
    const user = this.findById(id);
    Object.assign(user, updateData);

    console.log(`Usuario con id ${id} actualizado`);
    return this.mapToDto(user);
  }

  public deleteUser(id: number): void {
    const userIndex = this.Users.findIndex((usr) => usr.id === id);
    if (userIndex === -1) {
      throw new NotFoundException('El usuario que se quiere borrar no existe');
    }

    this.Users.splice(userIndex, 1);
    console.log(`Se elimino el usuario con id ${id}`);
  }

  // HELPERS

  private findById(id: number): User {
    const user = this.Users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  public findByEmail(email: string): User | undefined {
    return this.Users.find((u) => u.email === email);
  }

  private mapToDomain(user: CreateUserDto): User {
    return {
      id: this.nextId++,
      email: user.email,
      password: user.password,
    };
  }

  private mapToDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
    };
  }

  private validateEmailExists(email: string): void {
    const userExists = this.Users.find((u) => u.email === email);
    if (userExists) {
      throw new ConflictException('El usuario ya existe');
    }
  }
}
