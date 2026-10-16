import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/interfaces/users.interface';
import { UserDto } from '../users/dto/user.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 1,
    email: 'admin@flywise.com',
    password: 'secretPassword',
  };

  const mockUserDto: UserDto = {
    id: 1,
    email: 'admin@flywise.com',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mocked.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      usersService.findByEmail.mockReturnValue(mockUser);

      const result = await service.validateUser(
        'admin@flywise.com',
        'secretPassword',
      );
      expect(result).toEqual({
        id: 1,
        email: 'admin@flywise.com',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when password does not match', async () => {
      usersService.findByEmail.mockReturnValue(mockUser);

      const result = await service.validateUser(
        'admin@flywise.com',
        'wrongPassword',
      );
      expect(result).toBeNull();
    });

    it('should return null when user is not found', async () => {
      usersService.findByEmail.mockReturnValue(undefined);

      const result = await service.validateUser('unknown@flywise.com', 'any');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create and return the user through usersService', async () => {
      const createDto: CreateUserDto = {
        email: 'new@flywise.com',
        password: 'pass',
      };
      usersService.createUser.mockReturnValue(mockUserDto);

      const result = await service.register(createDto);
      expect(usersService.createUser).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('login', () => {
    it('should sign a JWT token with username and sub payload', async () => {
      const result = await service.login(mockUserDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        username: mockUserDto.email,
        sub: mockUserDto.id,
      });
      expect(result).toEqual({
        access_token: 'mocked.jwt.token',
      });
    });
  });
});
