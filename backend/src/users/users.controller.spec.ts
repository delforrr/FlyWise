import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let userService: jest.Mocked<UsersService>;

  const mockUserDto: UserDto = {
    id: 1,
    email: 'admin@flywise.com',
  };

  beforeEach(async () => {
    const mockService = {
      getUsers: jest.fn().mockReturnValue([mockUserDto]),
      getUserById: jest.fn().mockReturnValue(mockUserDto),
      getUserByEmail: jest.fn().mockReturnValue(mockUserDto),
      createUser: jest.fn().mockReturnValue(mockUserDto),
      updateUser: jest.fn().mockReturnValue(mockUserDto),
      deleteUser: jest.fn().mockReturnValue(undefined),
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
    it('should return all users when no email query is provided', () => {
      const result = controller.getUsers();
      expect(userService.getUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockUserDto]);
    });

    it('should return user by email when email query is provided', () => {
      const result = controller.getUsers('admin@flywise.com');
      expect(userService.getUserByEmail).toHaveBeenCalledWith(
        'admin@flywise.com',
      );
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('getUserById', () => {
    it('should return a user by id', () => {
      const result = controller.getUserById(1);
      expect(userService.getUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('postUser', () => {
    it('should create and return a new user', () => {
      const createDto: CreateUserDto = {
        email: 'new@flywise.com',
        password: 'password123',
      };
      const result = controller.postUser(createDto);
      expect(userService.createUser).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('putUser', () => {
    it('should update and return the user', () => {
      const updateDto: UpdateUserDto = {
        email: 'updated@flywise.com',
      };
      const result = controller.putUser(1, updateDto);
      expect(userService.updateUser).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('deleteUser', () => {
    it('should call deleteUser on the service', () => {
      controller.deleteUser(1);
      expect(userService.deleteUser).toHaveBeenCalledWith(1);
    });
  });
});
