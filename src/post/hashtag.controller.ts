import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
  HttpException,
  UseGuards,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { HashtagTrendService } from './services/hashtag-trends.service';
import { Services } from 'src/utils/constants';
import { Public } from 'src/auth/decorators/public.decorator';
import { TrendCategory, isValidTrendCategory } from './enums/trend-category.enum';

@Controller('hashtags')
export class HashtagController {
  private readonly logger = new Logger(HashtagController.name);

  constructor(
    @Inject(Services.HASHTAG_TRENDS)
    private readonly hashtagTrendService: HashtagTrendService,
  ) {}

  @Get('trending')
  @Public()
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
  ) {
    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    if (!isValidTrendCategory(category)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${Object.values(TrendCategory).join(', ')}`,
      );
    }

    const trending = await this.hashtagTrendService.getTrending(limit, category as TrendCategory);

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

  @Post('recalculate')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Trigger hashtag trend recalculation',
    description:
      'Manually triggers recalculation of trends for all active hashtags from the last 7 days, optionally filtered by category',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: TrendCategory,
    description:
      'Category to recalculate trends for. Options: general, news, sports, entertainment, personalized. Defaults to "general" which processes all hashtags.',
    example: TrendCategory.GENERAL,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully queued recalculation',
    schema: {
      example: {
        status: 'success',
        message: 'Queued recalculation for 45 hashtags',
        data: {
          queuedHashtags: 45,
          category: 'sports',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid category',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async recalculate(
    @Query('category', new DefaultValuePipe(TrendCategory.GENERAL)) category: string,
  ) {
    if (!isValidTrendCategory(category)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${Object.values(TrendCategory).join(', ')}`,
      );
    }

    const count = await this.hashtagTrendService.recalculateTrends(category as TrendCategory);

    return {
      status: 'success',
      message: `Queued recalculation for ${count} hashtags in ${category} category`,
      data: {
        queuedHashtags: count,
        category,
      },
    };
  }

  // @Post('reindex-hashtags')
  // @ApiCookieAuth()
  // @ApiOperation({
  //   summary: 'Reindex all post hashtags',
  //   description: 'Scans all posts and extracts hashtags, updating the hashtag relations.',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Successfully completed reindexing',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Internal server error',
  // })
  // async reindexHashtags() {
  //   const result = await this.hashtagTrendService.reindexAllPostHashtags();

  //   return {
  //     status: 'success',
  //     message: 'Hashtags reindexed',
  //     result,
  //   };
  // }
}
