import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export const MEMBER_SORTS = [
  'rank',
  'playerName',
  'clubName',
  'level',
  'path',
  'score',
  'fashion',
  'weeklyActivity',
  'joinedText',
] as const;

export type MemberSort = (typeof MEMBER_SORTS)[number];

export class ListMembersQuery {
  @IsOptional()
  @IsUUID('4', { message: '俱乐部不正确' })
  clubId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: '玩家名称过长' })
  keyword?: string;

  @IsOptional()
  @IsIn(MEMBER_SORTS, { message: '不能按该列排序' })
  sort?: MemberSort;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: '排序方向不正确' })
  order?: 'asc' | 'desc';
}

export class WriteMemberDto {
  @IsUUID('4', { message: '请选择俱乐部' })
  clubId!: string;

  @IsString()
  @MaxLength(40, { message: '玩家名称过长' })
  playerName!: string;

  @IsInt({ message: '排名必须是整数' })
  @Min(0, { message: '排名不能为负' })
  @Max(2147483647, { message: '排名超出范围' })
  rank!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: '等级必须是整数' })
  @Min(1, { message: '等级必须大于 0' })
  @Max(2147483647, { message: '等级超出范围' })
  level?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40, { message: '途径过长' })
  path?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: '非凡评分必须是整数' })
  @Min(0, { message: '非凡评分不能为负' })
  @Max(2147483647, { message: '非凡评分超出范围' })
  score?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: '风尚度必须是整数' })
  @Min(0, { message: '风尚度不能为负' })
  @Max(2147483647, { message: '风尚度超出范围' })
  fashion?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: '周活跃必须是整数' })
  @Min(0, { message: '周活跃不能为负' })
  @Max(2147483647, { message: '周活跃超出范围' })
  weeklyActivity?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40, { message: '入会时间过长' })
  joinedText?: string | null;
}

export class TemplateImportDto {
  @IsArray({ message: '校对结果无法解析' })
  @ArrayMinSize(1, { message: '请提交校对结果' })
  @ArrayMaxSize(1000, { message: '一次最多确认 1000 人' })
  rows!: unknown[];
}

export class DeleteMembersDto {
  @IsArray({ message: '请选择要删除的人员' })
  @ArrayUnique({ message: '人员重复' })
  @ArrayMinSize(1, { message: '请选择要删除的人员' })
  @ArrayMaxSize(500, { message: '一次最多删除 500 人' })
  @IsUUID('4', { each: true, message: '人员不正确' })
  ids!: string[];
}
