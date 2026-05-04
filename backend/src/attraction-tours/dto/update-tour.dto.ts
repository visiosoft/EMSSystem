import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateTourDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tourName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(1)
  attractionId?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(1)
  classId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  ascap?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  bmi?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  sesac?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  gmr?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === '' || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n : null;
  })
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  talentAgencyCompanyId?: number | null;

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
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === '' || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n : null;
  })
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  venueTypePreferenceId?: number | null;

  /** When true, clears Tour.BannerLinkID (multipart field). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  removeBanner?: boolean;
}
