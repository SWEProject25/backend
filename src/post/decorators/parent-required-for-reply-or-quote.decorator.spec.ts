import { validate } from 'class-validator';
import { IsParentRequiredForReplyOrQuote } from './parent-required-for-reply-or-quote.decorator';
import { PostType } from '@prisma/client';

class TestDto {
  @IsParentRequiredForReplyOrQuote()
  type: PostType;

  parentId?: number;
}

describe('IsParentRequiredForReplyOrQuote Decorator', () => {
  describe('when type is REPLY', () => {
    it('should fail when parentId is null', async () => {
      const dto = new TestDto();
      dto.type = PostType.REPLY;
      dto.parentId = null as any;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'type')).toBe(true);
    });

    it('should fail when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.REPLY;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'type')).toBe(true);
    });

    it('should pass when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.REPLY;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('when type is QUOTE', () => {
    it('should fail when parentId is null', async () => {
      const dto = new TestDto();
      dto.type = PostType.QUOTE;
      dto.parentId = null as any;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'type')).toBe(true);
    });

    it('should fail when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.QUOTE;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'type')).toBe(true);
    });

    it('should pass when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.QUOTE;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('when type is POST', () => {
    it('should pass when parentId is null', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass when parentId is undefined', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = undefined;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass when parentId is provided', async () => {
      const dto = new TestDto();
      dto.type = PostType.POST;
      dto.parentId = 123;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
