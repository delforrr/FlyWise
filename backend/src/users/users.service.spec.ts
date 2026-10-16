import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user successfully', () => {
      const result = service.createUser({
        email: 'test@flywise.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: expect.any(Number),
        email: 'test@flywise.com',
      });
      expect(result.id).toBe(1);
    });

    it('should throw ConflictException if user email already exists', () => {
      service.createUser({
        email: 'duplicate@flywise.com',
        password: 'password123',
      });

      expect(() => {
        service.createUser({
          email: 'duplicate@flywise.com',
          password: 'password456',
        });
      }).toThrow(ConflictException);
    });
  });

  describe('getUsers', () => {
    it('should return all users', () => {
      service.createUser({ email: 'u1@flywise.com', password: 'p1' });
      service.createUser({ email: 'u2@flywise.com', password: 'p2' });

      const users = service.getUsers();
      expect(users).toHaveLength(2);
      expect(users[0].email).toBe('u1@flywise.com');
      expect(users[1].email).toBe('u2@flywise.com');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', () => {
      const created = service.createUser({
        email: 'findme@flywise.com',
        password: 'p',
      });
      const found = service.getUserById(created.id);

      expect(found).toEqual(created);
    });

    it('should throw NotFoundException if user id does not exist', () => {
      expect(() => service.getUserById(999)).toThrow(NotFoundException);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', () => {
      const created = service.createUser({
        email: 'email@flywise.com',
        password: 'p',
      });
      const found = service.getUserByEmail('email@flywise.com');

      expect(found).toEqual(created);
    });

    it('should throw NotFoundException if user email does not exist', () => {
      expect(() => service.getUserByEmail('notfound@flywise.com')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user fields successfully', () => {
      const created = service.createUser({
        email: 'update@flywise.com',
        password: 'p',
      });
      const updated = service.updateUser(created.id, {
        email: 'updated@flywise.com',
      });

      expect(updated.email).toBe('updated@flywise.com');
    });

    it('should throw NotFoundException if user to update is not found', () => {
      expect(() => service.updateUser(999, { email: 'x@flywise.com' })).toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user successfully', () => {
      const created = service.createUser({
        email: 'delete@flywise.com',
        password: 'p',
      });
      expect(() => service.deleteUser(created.id)).not.toThrow();
      expect(() => service.getUserById(created.id)).toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user to delete does not exist', () => {
      expect(() => service.deleteUser(999)).toThrow(NotFoundException);
    });
  });
});
