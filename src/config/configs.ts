import * as dotenv from 'dotenv';
import * as process from 'process';
dotenv.config();

export default {
  openAiApiKey: process.env.OPENAI_API_KEY,
};
