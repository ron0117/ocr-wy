import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RegistrationAttendanceStatus, RegistrationProfession } from '@prisma/client';

export class SubmitRegistrationDto {
  @IsUUID('4', { message: '俱乐部不正确' })
  clubId!: string;

  @IsString({ message: '请填写非凡者名称' })
  @MaxLength(64, { message: '名称过长' })
  playerName!: string;

  @IsInt({ message: '评分须为整数' })
  @Min(1, { message: '评分须为正整数' })
  @Max(999999, { message: '评分最多 6 位' })
  score!: number;

  @IsEnum(RegistrationProfession, { message: '职业不正确' })
  profession!: RegistrationProfession;
}

export class ListRegistrationsQuery {
  @IsUUID('4', { message: '活动不正确' })
  activityId!: string;

  @IsOptional()
  @IsUUID('4', { message: '俱乐部不正确' })
  clubId?: string;

  @IsOptional()
  @IsIn(['playerName', 'clubName', 'score', 'profession', 'attendanceStatus', 'createdAt'], {
    message: '排序字段不正确',
  })
  sortBy?: 'playerName' | 'clubName' | 'score' | 'profession' | 'attendanceStatus' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: '排序方向不正确' })
  sortOrder?: 'asc' | 'desc';
}

export class PatchRegistrationDto {
  @IsOptional()
  @IsUUID('4', { message: '俱乐部不正确' })
  clubId?: string;

  @IsOptional()
  @IsString({ message: '名称不正确' })
  @MaxLength(64, { message: '名称过长' })
  playerName?: string;

  @IsOptional()
  @IsInt({ message: '评分须为整数' })
  @Min(1, { message: '评分须为正整数' })
  @Max(999999, { message: '评分最多 6 位' })
  score?: number;

  @IsOptional()
  @IsEnum(RegistrationProfession, { message: '职业不正确' })
  profession?: RegistrationProfession;

  @IsOptional()
  @IsEnum(RegistrationAttendanceStatus, { message: '出席状态不正确' })
  attendanceStatus?: RegistrationAttendanceStatus;
}
