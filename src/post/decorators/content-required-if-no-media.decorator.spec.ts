import { validate } from 'class-validator';
import { IsContentRequiredIfNoMedia } from './content-required-if-no-media.decorator';

class TestDto {
  @IsContentRequiredIfNoMedia()
  content: string;

  media?: any[];
}

describe('IsContentRequiredIfNoMedia Decorator', () => {
  describe('when no media is provided', () => {
    it('should pass with valid content', async () => {
      const dto = new TestDto();
      dto.content = 'Valid content';
      dto.media = [];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty content', async () => {
      const dto = new TestDto();
      dto.content = '';
      dto.media = [];

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'content')).toBe(true);
    });

    it('should fail with whitespace-only content', async () => {
      const dto = new TestDto();
      dto.content = '   ';
      dto.media = [];

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'content')).toBe(true);
    });

    it('should fail with null content', async () => {
      const dto = new TestDto();
      dto.content = null as any;
      dto.media = [];

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'content')).toBe(true);
    });

    it('should fail when media is undefined', async () => {
      const dto = new TestDto();
      dto.content = '';
      dto.media = undefined;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'content')).toBe(true);
    });
  });

  describe('when media is provided', () => {
    it('should pass with empty content when media exists', async () => {
      const dto = new TestDto();
      dto.content = '';
      dto.media = [{ url: 'http://example.com/image.jpg' }];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with null content when media exists', async () => {
      const dto = new TestDto();
      dto.content = null as any;
      dto.media = [{ url: 'http://example.com/image.jpg' }];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with valid content and media', async () => {
      const dto = new TestDto();
      dto.content = 'Some content';
      dto.media = [{ url: 'http://example.com/image.jpg' }];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with multiple media items', async () => {
      const dto = new TestDto();
      dto.content = '';
      dto.media = [
        { url: 'http://example.com/image1.jpg' },
        { url: 'http://example.com/image2.jpg' },
      ];

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
