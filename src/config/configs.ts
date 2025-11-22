import * as dotenv from 'dotenv';
import * as process from 'process';
dotenv.config();

export default {
    openAiApiKey: process.env.openAiApiKey,
}