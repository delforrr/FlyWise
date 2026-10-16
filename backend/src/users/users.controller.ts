import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { type UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBody, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @ApiQuery({ name: 'email', required: false, type: 'string' })
  @Get()
  getUsers(@Query('email') email?: string): UserDto | UserDto[] {
    if (email) {
      return this.userService.getUserByEmail(email);
    }
    return this.userService.getUsers();
  }

  @ApiParam({
    name: 'id',
    required: true,
    type: 'string',
  })
  @Get('/:id')
  getUserById(@Param('id', ParseIntPipe) id: number): UserDto {
    return this.userService.getUserById(id);
  }

  @ApiBody({
    type: CreateUserDto,
  })
  @Post()
  postUser(@Body() createUserDto: CreateUserDto): UserDto {
    return this.userService.createUser(createUserDto);
  }

  @ApiParam({
    name: 'id',
    required: true,
    type: 'number',
  })
  @ApiBody({ type: UpdateUserDto })
  @Patch('/:id')
  putUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): UserDto | undefined {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    this.userService.deleteUser(id);
  }
}
