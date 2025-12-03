import * as Joi from 'joi';

const envSchema = Joi.object({
  OPENAI_API_KEY: Joi.string().required(),
}).strict();

export default envSchema;
