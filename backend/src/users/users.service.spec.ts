import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mockCollection } from '../../test/helpers/prisma-mock.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { models: { Usuario: ReturnType<typeof mockCollection> } };

  const mockUserEntity = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    correo: 'admin@flywise.com',
    hashContrasena: '$2b$10$mockedpasswordhash',
    rol: 'ADMIN',
    creadoEn: '2026-09-01 00:00:00',
    actualizadoEn: '2026-09-01 00:00:00',
  };

  beforeEach(async () => {
    prisma = { models: { Usuario: mockCollection() } };
    prisma.models.Usuario.all.mockResolvedValue([mockUserEntity]);
    prisma.models.Usuario.create.mockResolvedValue(mockUserEntity);
    prisma.models.Usuario.update.mockResolvedValue({
      ...mockUserEntity,
      correo: 'updated@flywise.com',
    });
    prisma.models.Usuario.delete.mockResolvedValue(mockUserEntity);

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
    it('returns a conflict if another request registers the same correo first', async () => {
      prisma.models.Usuario.first.mockResolvedValue(null);
      prisma.models.Usuario.create.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate correo'), { sqlState: '23505' }),
      );
      await expect(
        service.createUser({
          correo: 'race@example.test',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
    it('should create a user successfully with hashed password', async () => {
      prisma.models.Usuario.first.mockResolvedValue(null);
      const result = await service.createUser({
        correo: 'test@flywise.com',
        password: 'password123',
      });

      expect(prisma.models.Usuario.create).toHaveBeenCalled();
      expect(result.correo).toBe('admin@flywise.com');
      expect(result.id).toBe(mockUserEntity.id);
    });

    it('should throw ConflictException if user correo already exists', async () => {
      prisma.models.Usuario.create.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate correo'), { sqlState: '23505' }),
      );

      await expect(
        service.createUser({
          correo: 'admin@flywise.com',
          password: 'password456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUsers', () => {
    it('should return all usuarios', async () => {
      const usuarios = await service.getUsers();
      expect(prisma.models.Usuario.all).toHaveBeenCalled();
      expect(usuarios).toHaveLength(1);
      expect(usuarios[0].correo).toBe('admin@flywise.com');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      prisma.models.Usuario.firstOrThrow.mockResolvedValue(mockUserEntity);
      const found = await service.getUserById(mockUserEntity.id);

      expect(found.id).toBe(mockUserEntity.id);
      expect(found.correo).toBe(mockUserEntity.correo);
    });

    it('should throw NotFoundException if user id does not exist', async () => {
      prisma.models.Usuario.firstOrThrow.mockRejectedValueOnce(
        Object.assign(new Error('Missing user'), { code: 'RUNTIME.NO_ROWS' }),
      );
      await expect(service.getUserById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by correo', async () => {
      prisma.models.Usuario.firstOrThrow.mockResolvedValue(mockUserEntity);
      const found = await service.getUserByEmail('admin@flywise.com');

      expect(found.correo).toBe('admin@flywise.com');
    });

    it('should throw NotFoundException if user correo does not exist', async () => {
      prisma.models.Usuario.firstOrThrow.mockRejectedValueOnce(
        Object.assign(new Error('Missing user'), { code: 'RUNTIME.NO_ROWS' }),
      );
      await expect(
        service.getUserByEmail('notfound@flywise.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('returns a conflict when concurrent updates claim the same correo', async () => {
      prisma.models.Usuario.first
        .mockResolvedValueOnce(mockUserEntity)
        .mockResolvedValueOnce(null);
      prisma.models.Usuario.update.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate correo'), { sqlState: '23505' }),
      );
      await expect(
        service.updateUser(mockUserEntity.id, { correo: 'race@example.test' }),
      ).rejects.toThrow(ConflictException);
    });
    it('should update user fields successfully', async () => {
      prisma.models.Usuario.first
        .mockResolvedValueOnce(mockUserEntity)
        .mockResolvedValueOnce(null);
      const updated = await service.updateUser(mockUserEntity.id, {
        correo: 'updated@flywise.com',
      });

      expect(prisma.models.Usuario.update).toHaveBeenCalled();
      expect(updated.correo).toBe('updated@flywise.com');
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      prisma.models.Usuario.update.mockResolvedValueOnce(null);
      await expect(
        service.updateUser('non-existent-uuid', { correo: 'x@flywise.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user successfully', async () => {
      prisma.models.Usuario.first.mockResolvedValue(mockUserEntity);
      await expect(
        service.deleteUser(mockUserEntity.id),
      ).resolves.not.toThrow();
      expect(prisma.models.Usuario.where).toHaveBeenCalledWith({
        id: mockUserEntity.id,
      });
    });

    it('should throw NotFoundException if user to delete does not exist', async () => {
      prisma.models.Usuario.delete.mockResolvedValueOnce(null);
      await expect(service.deleteUser('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
