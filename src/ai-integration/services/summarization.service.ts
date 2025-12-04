import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import configs from 'src/config/configs';

@Injectable()
export class AiSummarizationService {
  private readonly groq: Groq;

  constructor() {
    if (!configs.groqApiKey) {
      throw new Error('GROQ_API_KEY is not defined');
    }

    this.groq = new Groq({
      apiKey: configs.groqApiKey,
    });
  }

  async summarizePost(text: string): Promise<string> {
    try {
      const response = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Fast and best quality
        messages: [
          {
            role: "user",
            content: `Summarize the following post in one short sentence:\n\n"${text}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      const summary = response.choices[0]?.message?.content;

      if (!summary || summary.trim().length === 0) {
        return 'Summary unavailable.';
      }

      return summary;
    } catch (error) {
      console.error('Error summarizing post:', error);
      return 'Summary unavailable.';
    }
  }
}
