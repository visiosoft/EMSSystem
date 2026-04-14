import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTourDto {
  @IsString()
  @MaxLength(200)
  tourName: string;

  @IsInt()
  @Min(1)
  attractionId: number;

  @IsInt()
  @Min(1)
  classId: number;

  @IsOptional()
  @IsBoolean()
  ascap?: boolean;

  @IsOptional()
  @IsBoolean()
  bmi?: boolean;

  @IsOptional()
  @IsBoolean()
  sesac?: boolean;

  @IsOptional()
  @IsBoolean()
  gmr?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  tourManagementCompanyId?: number | null;
}
