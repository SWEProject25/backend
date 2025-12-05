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
    description: 'Returns a list of trending hashtags based on recent activity (1h, 24h, 7d)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of trending hashtags to return (1-50)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved trending hashtags',
  })
  @ApiResponse({
    status: 400,
    description: 'Limit must be between 1 and 50',
  })
  async getTrending(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    const trending = await this.hashtagTrendService.getTrending(limit);

    return {
      status: 'success',
      data: { trending },
      metadata: {
        HashtagsCount: trending.length,
        limit,
      },
    };
  }

  @Post('recalculate')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Trigger hashtag trend recalculation',
    description:
      'Manually triggers recalculation of trends for all active hashtags from the last 7 days',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully queued recalculation',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async recalculate() {
    const count = await this.hashtagTrendService.recalculateTrends();

    return {
      status: 'success',
      message: `Queued recalculation for ${count} hashtags`,
      data: {
        queuedHashtags: count,
      },
    };
  }

  @Post('reindex-hashtags')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Reindex all post hashtags',
    description: 'Scans all posts and extracts hashtags, updating the hashtag relations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully completed reindexing',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async reindexHashtags() {
    const result = await this.hashtagTrendService.reindexAllPostHashtags();

    return {
      status: 'success',
      message: 'Hashtags reindexed',
      result,
    };
  }
}
