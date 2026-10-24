import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mockCollection } from '../../test/helpers/prisma-mock.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { models: { User: ReturnType<typeof mockCollection> } };

  const mockUserEntity = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'admin@flywise.com',
    passwordHash: '$2b$10$mockedpasswordhash',
    role: 'ADMIN',
    createdAt: '2026-09-01 00:00:00',
    updatedAt: '2026-09-01 00:00:00',
  };

  beforeEach(async () => {
    prisma = { models: { User: mockCollection() } };
    prisma.models.User.all.mockResolvedValue([mockUserEntity]);
    prisma.models.User.create.mockResolvedValue(mockUserEntity);
    prisma.models.User.update.mockResolvedValue({
      ...mockUserEntity,
      email: 'updated@flywise.com',
    });
    prisma.models.User.delete.mockResolvedValue(mockUserEntity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('returns a conflict if another request registers the same email first', async () => {
      prisma.models.User.first.mockResolvedValue(null);
      prisma.models.User.create.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate email'), { sqlState: '23505' }),
      );
      await expect(
        service.createUser({
          email: 'race@example.test',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
    it('should create a user successfully with hashed password', async () => {
      prisma.models.User.first.mockResolvedValue(null);
      const result = await service.createUser({
        email: 'test@flywise.com',
        password: 'password123',
      });

      expect(prisma.models.User.create).toHaveBeenCalled();
      expect(result.email).toBe('admin@flywise.com');
      expect(result.id).toBe(mockUserEntity.id);
    });

    it('should throw ConflictException if user email already exists', async () => {
      prisma.models.User.create.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate email'), { sqlState: '23505' }),
      );

      await expect(
        service.createUser({
          email: 'admin@flywise.com',
          password: 'password456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      const users = await service.getUsers();
      expect(prisma.models.User.all).toHaveBeenCalled();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('admin@flywise.com');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      prisma.models.User.firstOrThrow.mockResolvedValue(mockUserEntity);
      const found = await service.getUserById(mockUserEntity.id);

      expect(found.id).toBe(mockUserEntity.id);
      expect(found.email).toBe(mockUserEntity.email);
    });

    it('should throw NotFoundException if user id does not exist', async () => {
      prisma.models.User.firstOrThrow.mockRejectedValueOnce(
        Object.assign(new Error('Missing user'), { code: 'RUNTIME.NO_ROWS' }),
      );
      await expect(service.getUserById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      prisma.models.User.firstOrThrow.mockResolvedValue(mockUserEntity);
      const found = await service.getUserByEmail('admin@flywise.com');

      expect(found.email).toBe('admin@flywise.com');
    });

    it('should throw NotFoundException if user email does not exist', async () => {
      prisma.models.User.firstOrThrow.mockRejectedValueOnce(
        Object.assign(new Error('Missing user'), { code: 'RUNTIME.NO_ROWS' }),
      );
      await expect(
        service.getUserByEmail('notfound@flywise.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('returns a conflict when concurrent updates claim the same email', async () => {
      prisma.models.User.first
        .mockResolvedValueOnce(mockUserEntity)
        .mockResolvedValueOnce(null);
      prisma.models.User.update.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate email'), { sqlState: '23505' }),
      );
      await expect(
        service.updateUser(mockUserEntity.id, { email: 'race@example.test' }),
      ).rejects.toThrow(ConflictException);
    });
    it('should update user fields successfully', async () => {
      prisma.models.User.first
        .mockResolvedValueOnce(mockUserEntity)
        .mockResolvedValueOnce(null);
      const updated = await service.updateUser(mockUserEntity.id, {
        email: 'updated@flywise.com',
      });

      expect(prisma.models.User.update).toHaveBeenCalled();
      expect(updated.email).toBe('updated@flywise.com');
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      prisma.models.User.update.mockResolvedValueOnce(null);
      await expect(
        service.updateUser('non-existent-uuid', { email: 'x@flywise.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user successfully', async () => {
      prisma.models.User.first.mockResolvedValue(mockUserEntity);
      await expect(
        service.deleteUser(mockUserEntity.id),
      ).resolves.not.toThrow();
      expect(prisma.models.User.where).toHaveBeenCalledWith({
        id: mockUserEntity.id,
      });
    });

    it('should throw NotFoundException if user to delete does not exist', async () => {
      prisma.models.User.delete.mockResolvedValueOnce(null);
      await expect(service.deleteUser('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
