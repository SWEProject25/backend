import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import configs from 'src/config/configs';
import { ALL_INTERESTS } from 'src/users/enums/user-interest.enum';

@Injectable()
export class AiSummarizationService {
  private readonly groq: Groq;

  constructor() {
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
        return '';
      }

      return summary;
    } catch (error) {
      console.error('Error summarizing post:', error);
      return '';
    }
  }

  async extractInterest(text: string): Promise<string> {
    try {
      const response = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a content categorization assistant. Your task is to classify posts into ONE of the following interests: ${ALL_INTERESTS.join(', ')}. Respond with ONLY the interest category name, nothing else.`,
          },
          {
            role: "user",
            content: `Classify this post into the most relevant interest category:\n\n"${text}"\n\nRespond with only ONE category from the list.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 20,
      });

      const interestsText = response.choices[0]?.message?.content?.trim();

      if (!interestsText || interestsText.length === 0) {
        return '';  
      }

      const normalizedResponse = interestsText.toUpperCase().replaceAll(/[^A-Z]/g, '');
      const matchedInterest = ALL_INTERESTS.find(
        interest => interest.toUpperCase().replaceAll(/[^A-Z]/g, '') === normalizedResponse
      );

      return matchedInterest || '';
    } catch (error) {
      console.error('Error extracting interests from post:', error);
      return '';
    }
  }
}
