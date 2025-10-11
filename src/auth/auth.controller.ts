import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with the provided details',
  })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input data' })
  @ApiResponse({ status: 409, description: 'Conflict - User already exists' })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.registerUser(createUserDto);
  }
}
