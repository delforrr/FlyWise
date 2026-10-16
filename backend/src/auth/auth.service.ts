import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/interfaces/users.interface';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserDto } from '../users/dto/user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = this.usersService.findByEmail(email);
    if (user && user.password === pass) {
      return Promise.resolve({
        id: user.id,
        email: user.email,
      });
    }
    return Promise.resolve(null);
  }

  async register(createUserDto: CreateUserDto): Promise<UserDto> {
    return Promise.resolve(this.usersService.createUser(createUserDto));
  }

  async login(user: UserDto) {
    const payload = {
      username: user.email,
      sub: user.id,
    };
    const token = this.jwtService.sign(payload);
    return Promise.resolve({
      access_token: token,
      accessToken: token,
      user,
    });
  }
}
