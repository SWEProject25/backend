import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  public async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  public async verify(
    hashedPassword: string,
    plainPassword: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
}
