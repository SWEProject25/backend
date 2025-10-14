import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  // req.user
  async validate(email: string, password: string) {
    if (password === '') {
      throw new BadRequestException('Please provide your password');
    }
    return await this.authService.validateLocalUser(email, password);
  }
}
