import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginRequestDto } from './login-request.dto.js';
import { RegisterUserDto } from './register-user.dto.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';
import { UpdateUserDto } from '../../users/dto/update-user.dto.js';

describe.each([LoginRequestDto, RegisterUserDto, CreateUserDto, UpdateUserDto])(
  '%s credentials',
  (Dto) => {
    it('normalizes email while preserving the exact password, including symbols and spaces', () => {
      const dto = plainToInstance(Dto, {
        email: ' USER@example.test ',
        password: ' strong password! ',
      });
      expect(validateSync(dto)).toEqual([]);
      expect(dto.email).toBe('user@example.test');
      expect(dto.password).toBe(' strong password! ');
    });

    it.each(['é'.repeat(37), 'x'.repeat(73), 12345678])(
      'rejects passwords bcrypt cannot safely distinguish: %s',
      (password) => {
        const dto = plainToInstance(Dto, {
          email: 'user@example.test',
          password,
        });
        expect(validateSync(dto)).not.toHaveLength(0);
      },
    );
  },
);
