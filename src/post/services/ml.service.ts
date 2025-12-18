// ==================== ML SERVICE ====================
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

interface MLPostInput {
  postId: number;
  contentLength: number;
  hasMedia: boolean;
  hashtagCount: number;
  mentionCount: number;
  author: {
    authorId: number;
    authorFollowersCount: number;
    authorFollowingCount: number;
    authorTweetCount: number;
    authorIsVerified: boolean;
  };
}

interface MLPredictionResponse {
  rankedPosts: Array<{
    postId: number;
    qualityScore: number;
  }>;
}

@Injectable()
export class MLService {
  private readonly logger = new Logger(MLService.name);
  private readonly mlServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mlServiceUrl =
      this.configService.get<string>('PREDICTION_SERVICE_URL') || 'http://127.0.0.1:8001/predict';
  }

  /**
   * Gets quality scores from ML model for given posts
   * @param posts Array of posts with features for ML prediction
   * @returns Map of postId -> qualityScore
   */
  async getQualityScores(posts: MLPostInput[]): Promise<Map<number, number>> {
    if (!posts.length) {
      return new Map();
    }

    try {
      this.logger.log(`Requesting quality scores for ${posts.length} posts`);

      const response = await firstValueFrom(
        this.httpService.post<MLPredictionResponse>(
          this.mlServiceUrl,
          { posts },
          { timeout: 5000 }, // 5 second timeout
        ),
      );

      const qualityScores = new Map(
        response.data.rankedPosts.map((p) => [p.postId, p.qualityScore]),
      );

      this.logger.log(`Received ${qualityScores.size} quality scores`);
      return qualityScores;
    } catch (error) {
      this.logger.error(`Failed to get quality scores from ML service: ${error.message}`);
      // Return empty map on failure - caller should handle gracefully
      return new Map();
    }
  }
}
