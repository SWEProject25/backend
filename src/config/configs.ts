import * as dotenv from 'dotenv';
import * as process from 'process';
dotenv.config();

export default {
    groqApiKey: process.env.GROQ_API_KEY,
}
