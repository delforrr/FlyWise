import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserDto } from '../users/dto/user.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserDto: UserDto = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    email: 'admin@flywise.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn().mockReturnValue({
        access_token: 'mock.token',
        accessToken: 'mock.token',
        user: mockUserDto,
      }),
      register: jest.fn().mockResolvedValue(mockUserDto),
      getProfile: jest.fn().mockResolvedValue(mockUserDto),
      logout: jest.fn().mockResolvedValue(undefined),
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
    it('should return an access token for authenticated user', () => {
      const result = controller.loginRequest(mockUserDto);

      expect(authService.login).toHaveBeenCalledWith(mockUserDto);
      expect(result).toEqual({
        access_token: 'mock.token',
        accessToken: 'mock.token',
        user: mockUserDto,
      });
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

  describe('getProfile', () => {
    it('should return the current authenticated user', () => {
      const result = controller.getProfile(mockUserDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('logout', () => {
    it('should call req.logout, revoke token, and return success message', async () => {
      const mockReq = {
        logout: jest.fn(),
      };

      const result = await controller.logout(
        'Bearer sample.jwt.token',
        mockReq,
      );
      expect(mockReq.logout).toHaveBeenCalledTimes(1);
      expect(authService.logout).toHaveBeenCalledWith('sample.jwt.token');
      expect(result).toEqual({
        message: 'Sesión cerrada exitosamente. Token invalidado.',
      });
    });
  });
});
