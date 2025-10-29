import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';

const MAX_FILE_SIZE_MB = 100; // 100 MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_FILE_TYPES_REGEX = 'image/(jpeg|png|gif)|video/(mp4|mpeg|quicktime|webm)';

export const ImageVideoUploadPipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({
      maxSize: MAX_FILE_SIZE_BYTES,
      message: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`,
    }),
    new FileTypeValidator({
      fileType: ALLOWED_FILE_TYPES_REGEX,
    }),
  ],
  fileIsRequired: false, 
});
