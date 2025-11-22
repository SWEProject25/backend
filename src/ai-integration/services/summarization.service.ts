import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import configs from 'src/config/configs';

@Injectable()
export class AiSummarizationService {
  private readonly openai: OpenAI;

  constructor() {
    if (!configs.openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not defined');
    }

    this.openai = new OpenAI({
      apiKey: configs.openAiApiKey,
    });
  }

  async summarizePost(text: string): Promise<string> {
    try {
      const prompt = `Summarize the following post:\n\n"${text}"`;

      // GPT-4.1 / GPT-4o / GPT-o-mini etc.
      const response = await this.openai.responses.create({
        model: "gpt-4o-mini", // similar price/perf to gemini flash
        input: prompt,
      });

      const summary =
        response.output_text;

      if (!summary || summary.trim().length === 0) {
        return "Summary unavailable.";
      }

      return summary;
    } catch (error) {
      console.error("Error summarizing post:", error);
      return "Summary unavailable.";
    }
  }
}
