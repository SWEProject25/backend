import * as Joi from 'joi';

const envSchema = Joi.object({
  GEMINI_API_KEY: Joi.string().required(),
}).strict();

export default envSchema;