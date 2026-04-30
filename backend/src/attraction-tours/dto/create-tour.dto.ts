import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourManagementCompanyId?: number | null;
}
