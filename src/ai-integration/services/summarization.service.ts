import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import configs from 'src/config/configs';

@Injectable()
export class AiSummarizationService {
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    if (!configs.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not defined');
    }
    this.genAI = new GoogleGenerativeAI(configs.geminiApiKey);
  }

  async summarizePost(text: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize the following post: "${text}"`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}