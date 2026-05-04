import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTourDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tourName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  attractionId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId: number;

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

  /** Multipart sends numbers as strings — coerce like UpdateTourDto. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '' || value === null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  })
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  talentAgencyCompanyId?: number;
}
