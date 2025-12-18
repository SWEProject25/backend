import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { PostType } from '@prisma/client';

export function IsParentRequiredForReplyOrQuote(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isParentRequiredForReplyOrQuote',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;

          // If type is REPLY or QUOTE → parentId must exist
          if (
            (dto.type === PostType.REPLY || dto.type === PostType.QUOTE) &&
            (dto.parentId === null || dto.parentId === undefined)
          ) {
            return false;
          }

          // Otherwise valid
          return true;
        },

        defaultMessage(args: ValidationArguments) {
          return 'parentId is required when type is REPLY or QUOTE';
        },
      },
    });
  };
}
