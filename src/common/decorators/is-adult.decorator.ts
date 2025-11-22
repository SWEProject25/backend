import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsAdult(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsAdult',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (!value) return false;

          const birthDate = new Date(value);
          if (isNaN(birthDate.getTime())) return false; // invalid date

          const today = new Date();
          const age =
            today.getFullYear() -
            birthDate.getFullYear() -
            (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
              ? 1
              : 0);

          return age >= 15 && age <= 100;
        },
        defaultMessage() {
          return 'User must be between 15 and 100 years old';
        },
      },
    });
  };
}
