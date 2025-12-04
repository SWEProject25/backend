// src/common/validators/parent-id.validator.ts
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { PostType } from '@prisma/client';

export function IsParentIdAllowed(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isParentIdAllowed',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;

          if (dto.type === PostType.POST && value !== undefined && value !== null) {
            return false;
          }

          return true;
        },

        defaultMessage(args: ValidationArguments) {
          return `parentId is not allowed when type is POST`;
        },
      },
    });
  };
}
