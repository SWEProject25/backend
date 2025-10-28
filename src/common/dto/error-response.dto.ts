import { ApiProperty } from '@nestjs/swagger';
import { ResponseStatus } from './base-api-response.dto';

export class ErrorResponseDto {
  @ApiProperty({
    enum: [ResponseStatus.ERROR, ResponseStatus.FAIL],
    example: ResponseStatus.ERROR,
  })
  status: ResponseStatus.ERROR | ResponseStatus.FAIL;

  @ApiProperty({ example: 'Invalid input data' })
  message: string;

  @ApiProperty({
    nullable: true,
    example: 'Bad Request',
    description: 'Optional error details or the type of error',
  })
  error?: any;

  static schemaExample(message: string, error?: string, status: 'error' | 'fail' = 'error') {
    return {
      type: 'object',
      properties: {
        status: { type: 'string', example: status },
        message: { type: 'string', example: message },
        error: { type: 'string', example: error || null },
      },
    };
  }
}
