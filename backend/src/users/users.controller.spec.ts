import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserDto } from './dto/user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

describe('UsersController', () => {
  let controller: UsersController;
  let userService: jest.Mocked<UsersService>;

  const mockUserDto: UserDto = {
    id: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    email: 'admin@flywise.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    const mockService = {
      getUsers: jest.fn().mockResolvedValue([mockUserDto]),
      getUserById: jest.fn().mockResolvedValue(mockUserDto),
      getUserByEmail: jest.fn().mockResolvedValue(mockUserDto),
      createUser: jest.fn().mockResolvedValue(mockUserDto),
      updateUser: jest.fn().mockResolvedValue(mockUserDto),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    userService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      const result = await controller.getUsers();
      expect(userService.getUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockUserDto]);
    });
  });

  describe('getUserById', () => {
    it('should return a user by id', async () => {
      const result = await controller.getUserById(mockUserDto.id);
      expect(userService.getUserById).toHaveBeenCalledWith(mockUserDto.id);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('postUser', () => {
    it('should create and return a new user', async () => {
      const createDto: CreateUserDto = {
        email: 'new@flywise.com',
        password: 'password123',
      };
      const result = await controller.postUser(createDto);
      expect(userService.createUser).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('putUser', () => {
    it('should update and return the user', async () => {
      const updateDto: UpdateUserDto = {
        email: 'updated@flywise.com',
      };
      const result = await controller.putUser(mockUserDto.id, updateDto);
      expect(userService.updateUser).toHaveBeenCalledWith(
        mockUserDto.id,
        updateDto,
      );
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('deleteUser', () => {
    it('should call deleteUser on the service', async () => {
      await controller.deleteUser(mockUserDto.id);
      expect(userService.deleteUser).toHaveBeenCalledWith(mockUserDto.id);
    });
  });
});
