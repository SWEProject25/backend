import * as dotenv from 'dotenv';
import * as process from 'process';
dotenv.config();

export default {
    geminiApiKey: process.env.GEMINI_API_KEY, 
}