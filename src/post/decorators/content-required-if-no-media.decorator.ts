import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsContentRequiredIfNoMedia(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isContentRequiredIfNoMedia',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;

          const hasMedia =
            Array.isArray(dto.media) && dto.media.length > 0;

          if (!hasMedia) {
            return typeof value === 'string' && value.trim().length > 0;
          }

          return true;
        },

        defaultMessage(args: ValidationArguments) {
          return 'Content is required when no media is provided';
        },
      },
    });
  };
}
