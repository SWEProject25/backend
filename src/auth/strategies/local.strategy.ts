import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Services } from 'src/utils/constants';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(Services.AUTH)
    private readonly authService: AuthService,
  ) {
    super({
      usernameField: 'email',
    });
  }

  // req.user
  async validate(email: string, password: string) {
    if (password === '') {
      throw new BadRequestException('Please provide your password');
    }
    email = email.trim().toLowerCase();
    return await this.authService.validateLocalUser(email, password);
  }
}
