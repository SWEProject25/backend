import { validate } from 'class-validator';
import { IsParentIdAllowed } from './is-parent-id-allowed.decorator';
import { PostType } from '@prisma/client';

class TestDto {
  @IsParentIdAllowed()
  parentId?: number;

  type: PostType;
}

describe('IsParentIdAllowed Decorator', () => {
  describe('when type is POST', () => {
    it('should fail when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'parentId')).toBe(true);
    });

    it('should pass when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass when parentId is null', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('when type is REPLY', () => {
    it('should pass when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.REPLY;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.REPLY;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('when type is QUOTE', () => {
    it('should pass when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.QUOTE;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.QUOTE;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
