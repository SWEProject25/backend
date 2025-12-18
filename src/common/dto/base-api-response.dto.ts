import { ApiProperty } from '@nestjs/swagger';

export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  FAIL = 'fail',
}

export class ApiResponseDto<T> {
  @ApiProperty({
    enum: ResponseStatus,
    example: ResponseStatus.SUCCESS,
    description: 'The status of the response',
  })
  status: ResponseStatus;

  @ApiProperty({
    example: 'Operation successful',
    description: 'A descriptive message about the response',
  })
  message: string;

  @ApiProperty({
    nullable: true,
    description: 'The data payload of the response',
  })
  data?: T;
}
