import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, Max, Min, registerDecorator, type ValidationOptions } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function requiredText(emptyMessage: string, tooLongMessage: string, max: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'requiredText',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && value.length > 0 && [...value].length <= max;
        },
        defaultMessage(args) {
          const value = args?.value;
          if (typeof value === 'string' && [...value].length > max) return tooLongMessage;
          return emptyMessage;
        },
      },
    });
  };
}

export class SubmitApplicationDto {
  @Transform(({ value }) => trimString(value))
  @requiredText('请填写游戏名称', '游戏名称过长', 64)
  gameName!: string;

  @Type(() => Number)
  @IsInt({ message: '非凡评分必须是整数' })
  @Min(0, { message: '非凡评分不能为负' })
  @Max(2147483647, { message: '非凡评分超出范围' })
  score!: number;

  @Transform(({ value }) => trimString(value))
  @requiredText('请填写 uid', 'uid 过长', 64)
  uid!: string;

  @IsUUID('4', { message: '请选择工会' })
  clubId!: string;

  @Transform(({ value }) => trimString(value))
  @requiredText('请填写你选择无忧的理由', '理由过长', 500)
  reason!: string;
}

export class ListApplicationsQuery {
  @IsIn(['unread', 'read'], { message: '请选择未读或已读' })
  read!: 'unread' | 'read';
}

export class DecideApplicationDto {
  @IsIn(['APPROVED', 'REJECTED'], { message: '请选择同意或不同意' })
  decision!: 'APPROVED' | 'REJECTED';
}
