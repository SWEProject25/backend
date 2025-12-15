import { ErrorResponseDto } from './error-response.dto';
import { ResponseStatus } from './base-api-response.dto';

describe('ErrorResponseDto', () => {
  describe('schemaExample', () => {
    it('should return schema with default error status', () => {
      const result = ErrorResponseDto.schemaExample('Invalid input', 'Bad Request');

      expect(result).toEqual({
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Invalid input' },
          error: { type: 'string', example: 'Bad Request' },
        },
      });
    });

    it('should return schema with fail status', () => {
      const result = ErrorResponseDto.schemaExample('Validation failed', 'Validation Error', 'fail');

      expect(result).toEqual({
        type: 'object',
        properties: {
          status: { type: 'string', example: 'fail' },
          message: { type: 'string', example: 'Validation failed' },
          error: { type: 'string', example: 'Validation Error' },
        },
      });
    });

    it('should return schema with null error when not provided', () => {
      const result = ErrorResponseDto.schemaExample('Something went wrong');

      expect(result).toEqual({
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Something went wrong' },
          error: { type: 'string', example: null },
        },
      });
    });

    it('should return schema with explicit error status', () => {
      const result = ErrorResponseDto.schemaExample('Server error', 'Internal Error', 'error');

      expect(result).toEqual({
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Server error' },
          error: { type: 'string', example: 'Internal Error' },
        },
      });
    });
  });

  describe('instance properties', () => {
    it('should accept error status', () => {
      const dto = new ErrorResponseDto();
      dto.status = ResponseStatus.ERROR;
      dto.message = 'Error message';

      expect(dto.status).toBe(ResponseStatus.ERROR);
    });

    it('should accept fail status', () => {
      const dto = new ErrorResponseDto();
      dto.status = ResponseStatus.FAIL;
      dto.message = 'Fail message';

      expect(dto.status).toBe(ResponseStatus.FAIL);
    });

    it('should accept optional error property', () => {
      const dto = new ErrorResponseDto();
      dto.status = ResponseStatus.ERROR;
      dto.message = 'Error message';
      dto.error = { details: 'Additional info' };

      expect(dto.error).toEqual({ details: 'Additional info' });
    });
  });
});
