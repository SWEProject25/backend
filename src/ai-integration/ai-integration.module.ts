import { Module } from '@nestjs/common';
import { AiSummarizationService } from './services/summarization.service';
import { Services } from 'src/utils/constants';

@Module({
  providers: [
    {
      provide: Services.AI_SUMMARIZATION,
      useClass: AiSummarizationService,
    },
  ],
  exports: [
    {
      provide: Services.AI_SUMMARIZATION,
      useClass: AiSummarizationService,
    },
  ],
})
export class AiIntegrationModule { }
