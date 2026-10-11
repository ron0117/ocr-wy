import { IsArray, IsString, IsUUID, MaxLength } from 'class-validator';

export class WriteRoleDto {
  @IsString()
  @MaxLength(40, { message: '角色名称过长' })
  name!: string;

  @IsArray()
  @IsString({ each: true })
  menuKeys!: string[];

  @IsArray()
  @IsUUID('4', { each: true, message: '俱乐部不正确' })
  clubIds!: string[];
}
