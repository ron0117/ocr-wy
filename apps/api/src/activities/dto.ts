import { ArrayMinSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateActivityDto {
  @IsString({ message: '请填写活动标题' })
  @MaxLength(80, { message: '活动标题过长' })
  title!: string;

  @IsArray({ message: '请选择俱乐部' })
  @ArrayMinSize(1, { message: '请选择俱乐部' })
  @IsUUID('4', { each: true, message: '俱乐部不正确' })
  clubIds!: string[];

  @IsISO8601({}, { message: '开始时间不正确' })
  startsAt!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsISO8601({}, { message: '提醒时间不正确' })
  remindAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: '部门不正确' })
  @MaxLength(64, { each: true, message: '部门不正确' })
  partyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: '标签不正确' })
  @MaxLength(64, { each: true, message: '标签不正确' })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: '成员不正确' })
  @MaxLength(64, { each: true, message: '成员不正确' })
  userIds?: string[];
}

export class NotifyActivityDto {
  @IsIn(['publish', 'remind'], { message: '发送类型不正确' })
  kind!: 'publish' | 'remind';
}

export class BindMemberDto {
  @IsUUID('4', { message: '请选择角色' })
  memberId!: string;
}
