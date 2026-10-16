import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserDto } from '../users/dto/user.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserDto: UserDto = {
    id: 1,
    email: 'admin@flywise.com',
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn().mockResolvedValue({ access_token: 'mock.token' }),
      register: jest.fn().mockResolvedValue(mockUserDto),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginRequest', () => {
    it('should return an access token for authenticated user', async () => {
      const result = await controller.loginRequest(mockUserDto);

      expect(authService.login).toHaveBeenCalledWith(mockUserDto);
      expect(result).toEqual({ access_token: 'mock.token' });
    });
  });

  describe('register', () => {
    it('should register a new user and return user data', async () => {
      const createDto: CreateUserDto = {
        email: 'newadmin@flywise.com',
        password: 'securePassword123',
      };

      const result = await controller.register(createDto);
      expect(authService.register).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('logout', () => {
    it('should call req.logout', () => {
      const mockReq = {
        logout: jest.fn().mockReturnValue(true),
      };

      const result = controller.logout(mockReq);
      expect(mockReq.logout).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });
});
