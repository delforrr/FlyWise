import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockUserEntity = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'admin@flywise.com',
    passwordHash: '$2b$10$mockedpasswordhash',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([mockUserEntity]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(mockUserEntity),
        update: jest.fn().mockResolvedValue({
          ...mockUserEntity,
          email: 'updated@flywise.com',
        }),
        delete: jest.fn().mockResolvedValue(mockUserEntity),
      },
    };

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
    it('should create a user successfully with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.createUser({
        email: 'test@flywise.com',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.email).toBe('admin@flywise.com');
      expect(result.id).toBe(mockUserEntity.id);
    });

    it('should throw ConflictException if user email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserEntity);

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
      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('admin@flywise.com');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserEntity);
      const found = await service.getUserById(mockUserEntity.id);

      expect(found.id).toBe(mockUserEntity.id);
      expect(found.email).toBe(mockUserEntity.email);
    });

    it('should throw NotFoundException if user id does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserEntity);
      const found = await service.getUserByEmail('admin@flywise.com');

      expect(found.email).toBe('admin@flywise.com');
    });

    it('should throw NotFoundException if user email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.getUserByEmail('notfound@flywise.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('should update user fields successfully', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUserEntity)
        .mockResolvedValueOnce(null);
      const updated = await service.updateUser(mockUserEntity.id, {
        email: 'updated@flywise.com',
      });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(updated.email).toBe('updated@flywise.com');
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUser('non-existent-uuid', { email: 'x@flywise.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserEntity);
      await expect(
        service.deleteUser(mockUserEntity.id),
      ).resolves.not.toThrow();
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUserEntity.id },
      });
    });

    it('should throw NotFoundException if user to delete does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteUser('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
