import { Controller, Inject } from '@nestjs/common';
import { UserService } from './user.service';
import { Routes, Services } from 'src/utils/constants';

@Controller(Routes.USER)
export class UserController {
  constructor(
    @Inject(Services.USER)
    private readonly userService: UserService,
  ) {}
}
