import { IsOptional, IsString } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional()
  @IsString()
  name?: string;
}