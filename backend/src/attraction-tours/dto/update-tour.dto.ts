import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateTourDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tourName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attractionId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  classId?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  audienceGender?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  audienceAgeRange?: string | null;

  @IsOptional()
  @IsString()
  tourInsuranceLanguage?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  venueTypePreferenceId?: number | null;
}
