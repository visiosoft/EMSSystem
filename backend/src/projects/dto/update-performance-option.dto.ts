import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdatePerformanceOptionDto {
  @IsOptional()
  @IsISO8601()
  proposedDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  proposedTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  optionStatus?: string;
}
