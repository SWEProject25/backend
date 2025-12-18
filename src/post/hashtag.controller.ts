import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HashtagTrendService } from './services/hashtag-trends.service';
import { Services } from 'src/utils/constants';
import { TrendCategory, isValidTrendCategory } from './enums/trend-category.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PersonalizedTrendsService } from './services/personalized-trends.service';

@Controller('hashtags')
export class HashtagController {
  private readonly logger = new Logger(HashtagController.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
    @Inject(Services.PERSONALIZED_TRENDS)
    private readonly personalizedTrendService: PersonalizedTrendsService,
  ) {}

  @Get('trending')
  @ApiOperation({
    summary: 'Get trending hashtags',
    description:
      'Returns a list of trending hashtags based on recent activity (1h, 24h, 7d) filtered by category',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of trending hashtags to return (1-50)',
    example: 10,
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: TrendCategory,
    description:
      'Category to filter trends by. Options: "general" (all trends), "news" (news posts), "sports" (sports posts), "entertainment" (music, movies, gaming, etc.), "personalized" (based on user interests)',
    example: TrendCategory.GENERAL,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved trending hashtags',
    schema: {
      example: {
        status: 'success',
        data: {
          trending: [
            { tag: '#technology', totalPosts: 245 },
            { tag: '#ai', totalPosts: 189 },
            { tag: '#coding', totalPosts: 156 },
          ],
        },
        metadata: {
          HashtagsCount: 3,
          limit: 10,
          category: 'general',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters (limit out of range or invalid category)',
  })
  async getTrending(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('category', new DefaultValuePipe(TrendCategory.GENERAL)) category: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    if (!isValidTrendCategory(category)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${Object.values(TrendCategory).join(', ')}`,
      );
    }
    let trending;
    if (category === TrendCategory.PERSONALIZED && user?.id) {
      trending = await this.personalizedTrendService.getPersonalizedTrending(user.id, limit);
    } else {
      trending = await this.hashtagTrendService.getTrending(
        limit,
        category as TrendCategory,
        user?.id,
      );
    }
    return {
      status: 'success',
      data: { trending },
      metadata: {
        HashtagsCount: trending.length,
        limit,
        category,
      },
    };
  }
}
