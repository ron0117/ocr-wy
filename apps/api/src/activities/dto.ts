import { ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ActivityFieldsDto {
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
  @IsString({ message: '备注不正确' })
  @MaxLength(500, { message: '备注过长' })
  note?: string | null;
}
