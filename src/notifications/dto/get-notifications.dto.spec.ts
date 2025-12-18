import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetNotificationsDto } from './get-notifications.dto';

describe('GetNotificationsDto', () => {
  describe('page field', () => {
    it('should transform string page to number', async () => {
      const dto = plainToInstance(GetNotificationsDto, { page: '5' });
      expect(dto.page).toBe(5);
    });

    it('should have default value of 1', () => {
      const dto = new GetNotificationsDto();
      expect(dto.page).toBe(1);
    });

    it('should validate page is a positive integer', async () => {
      const dto = plainToInstance(GetNotificationsDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('should pass validation for valid page', async () => {
      const dto = plainToInstance(GetNotificationsDto, { page: 2 });
      const errors = await validate(dto);
      const pageErrors = errors.filter((e) => e.property === 'page');
      expect(pageErrors.length).toBe(0);
    });
  });

  describe('limit field', () => {
    it('should transform string limit to number', async () => {
      const dto = plainToInstance(GetNotificationsDto, { limit: '50' });
      expect(dto.limit).toBe(50);
    });

    it('should have default value of 20', () => {
      const dto = new GetNotificationsDto();
      expect(dto.limit).toBe(20);
    });

    it('should validate limit is a positive integer', async () => {
      const dto = plainToInstance(GetNotificationsDto, { limit: -5 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('should pass validation for valid limit', async () => {
      const dto = plainToInstance(GetNotificationsDto, { limit: 100 });
      const errors = await validate(dto);
      const limitErrors = errors.filter((e) => e.property === 'limit');
      expect(limitErrors.length).toBe(0);
    });
  });

  describe('unreadOnly field', () => {
    it('should transform string "true" to boolean', async () => {
      const dto = plainToInstance(GetNotificationsDto, { unreadOnly: 'true' });
      expect(dto.unreadOnly).toBe(true);
    });

    it('should transform boolean false correctly', async () => {
      const dto = plainToInstance(GetNotificationsDto, { unreadOnly: false });
      expect(dto.unreadOnly).toBe(false);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetNotificationsDto, {});
      const errors = await validate(dto);
      const unreadOnlyErrors = errors.filter((e) => e.property === 'unreadOnly');
      expect(unreadOnlyErrors.length).toBe(0);
    });

    it('should pass validation for boolean value', async () => {
      const dto = plainToInstance(GetNotificationsDto, { unreadOnly: true });
      const errors = await validate(dto);
      const unreadOnlyErrors = errors.filter((e) => e.property === 'unreadOnly');
      expect(unreadOnlyErrors.length).toBe(0);
    });
  });

  describe('include field', () => {
    it('should accept string value', async () => {
      const dto = plainToInstance(GetNotificationsDto, { include: 'DM,MENTION' });
      expect(dto.include).toBe('DM,MENTION');
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetNotificationsDto, {});
      const errors = await validate(dto);
      const includeErrors = errors.filter((e) => e.property === 'include');
      expect(includeErrors.length).toBe(0);
    });
  });

  describe('exclude field', () => {
    it('should accept string value', async () => {
      const dto = plainToInstance(GetNotificationsDto, { exclude: 'DM,FOLLOW' });
      expect(dto.exclude).toBe('DM,FOLLOW');
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetNotificationsDto, {});
      const errors = await validate(dto);
      const excludeErrors = errors.filter((e) => e.property === 'exclude');
      expect(excludeErrors.length).toBe(0);
    });
  });

  describe('combined validation', () => {
    it('should pass validation for complete valid DTO', async () => {
      const dto = plainToInstance(GetNotificationsDto, {
        page: 2,
        limit: 50,
        unreadOnly: true,
        include: 'LIKE,MENTION',
        exclude: 'DM',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for empty object (all optional)', async () => {
      const dto = plainToInstance(GetNotificationsDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
