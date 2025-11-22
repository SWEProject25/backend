import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PostType, PostVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsParentIdAllowed } from '../decorators/is-parent-id-allowed.decorator';
import { IsContentRequiredIfNoMedia } from '../decorators/content-required-if-no-media.decorator';

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

  userId: number;
}
