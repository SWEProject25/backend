import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { Services } from 'src/utils/constants';
import { generateOtp } from 'src/utils/otp.util';

const OTP_CACHE_PREFIX = 'otp:';
const OTP_TTL_SECONDS = 15 * 60; // 15 minutes in seconds

const COOLDOWN_CACHE_PREFIX = 'cooldown:otp:';
const COOLDOWN_TTL_SECONDS = 60; // 1 minute in seconds

@Injectable()
export class OtpService {
  constructor(
    @Inject(Services.REDIS)
    private readonly redisService: RedisService,
  ) {}

  async generateAndRateLimit(email: string, size = 6): Promise<string> {
    console.log(`\n[OTP] Generating OTP for: ${email}`);

    const otp = generateOtp(size);
    const otpKey = `${OTP_CACHE_PREFIX}${email}`;
    const cooldownKey = `${COOLDOWN_CACHE_PREFIX}${email}`;

    try {
      await this.redisService.set(otpKey, otp, OTP_TTL_SECONDS);
      console.log(`[OTP] ✅ Stored OTP: ${otpKey}`);

      await this.redisService.set(cooldownKey, 'true', COOLDOWN_TTL_SECONDS);
      console.log(`[OTP] ✅ Stored cooldown: ${cooldownKey}`);

      const storedOtp = await this.redisService.get(otpKey);
      const storedCooldown = await this.redisService.get(cooldownKey);

      if (storedOtp && storedCooldown) {
        console.log(`[OTP] ✅ Verification passed - OTP stored successfully`);
      } else {
        console.warn(
          `[OTP] ⚠️ Verification warning - OTP: ${storedOtp}, Cooldown: ${storedCooldown}`,
        );
      }
    } catch (error) {
      console.error('[OTP] ❌ Failed to store OTP:', error.message);
      throw error;
    }

    return otp;
  }

  async isRateLimited(email: string): Promise<boolean> {
    const cooldownKey = `${COOLDOWN_CACHE_PREFIX}${email}`;

    try {
      const result = await this.redisService.get(cooldownKey);
      const isLimited = !!result;
      console.log(`[OTP] Rate limit check for ${email}: ${isLimited}`);
      return isLimited;
    } catch (error) {
      console.error('[OTP] ❌ Error checking rate limit:', error.message);
      return false;
    }
  }

  async validate(email: string, otp: string): Promise<boolean> {
    const otpKey = `${OTP_CACHE_PREFIX}${email}`;

    try {
      const storedOtp = await this.redisService.get(otpKey);
      console.log(`[OTP] Validating - Provided: ${otp}, Stored: ${storedOtp}`);

      if (!storedOtp) {
        console.log(`[OTP] ❌ No OTP found for ${email}`);
        return false;
      }

      if (storedOtp !== otp) {
        console.log(`[OTP] ❌ OTP mismatch for ${email}`);
        return false;
      }

      await this.clearOtp(email);
      console.log(`[OTP] ✅ OTP validated and deleted for ${email}`);
      return true;
    } catch (error) {
      console.error('[OTP] ❌ Error validating OTP:', error.message);
      return false;
    }
  }

  async clearOtp(email: string): Promise<void> {
    const otpKey = `${OTP_CACHE_PREFIX}${email}`;
    const cooldownKey = `${COOLDOWN_CACHE_PREFIX}${email}`;

    try {
      await Promise.all([this.redisService.del(otpKey), this.redisService.del(cooldownKey)]);
      console.log(`[OTP] 🗑️ Cleared OTP and cooldown for ${email}`);
    } catch (error) {
      console.error('[OTP] ❌ Error clearing OTP:', error.message);
    }
  }
}
