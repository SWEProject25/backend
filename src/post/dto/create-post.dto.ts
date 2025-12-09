import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PostType, PostVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsParentIdAllowed } from '../decorators/is-parent-id-allowed.decorator';
import { IsContentRequiredIfNoMedia } from '../decorators/content-required-if-no-media.decorator';
import { IsParentRequiredForReplyOrQuote } from '../decorators/parent-required-for-reply-or-quote.decorator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Content must not exceed 500 characters' })
  @ApiProperty({
    description: 'The textual content of the post',
    example: 'Excited to share my new project today!',
    maxLength: 500,
  })
  @IsContentRequiredIfNoMedia()
  content: string;

  @IsParentRequiredForReplyOrQuote()
  @IsEnum(PostType, {
    message: `Type must be one of: ${Object.values(PostType).join(', ')}`,
  })
  @ApiProperty({
    description: 'The type of post (POST, REPLY, or QUOTE)',
    enum: PostType,
    example: PostType.POST,
  })
  type: PostType;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @ApiPropertyOptional({
    description: 'The ID of the parent post (used when this post is a reply or quote)',
    example: 42,
    type: Number,
    nullable: true,
  })
  @IsParentIdAllowed()
  parentId?: number;

  @IsEnum(PostVisibility, {
    message: `Visibility must be one of: ${Object.values(PostVisibility).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Visibility is required' })
  @ApiProperty({
    description: 'The visibility level of the post (EVERY_ONE, FOLLOWERS, MENTIONED, or VERIFIED)',
    enum: PostVisibility,
    example: PostVisibility.EVERY_ONE,
  })
  visibility: PostVisibility;

  // assigned in the controller
  @ApiPropertyOptional({
    description: 'Media files (images/videos) to attach to the post',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  media?: Express.Multer.File[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Optional array of user IDs to mention. Accepts array [1,2,3] or comma-separated string "1,2,3"',
    example: [1, 2, 3],
  })
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }

    if (typeof value === 'string') {
      // parsing "[1,2,3]"
      try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          return parsed.map((v) => Number(v));
        }
        if (typeof parsed === 'string') {
          return parsed.split(',').map((v) => Number(v.trim()));
        }
      } catch {
        // fall back to comma-separated string
      }
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '')
        .map((v) => Number(v));
    }

    return undefined;
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  mentionsIds?: number[];

  userId: number;
}
