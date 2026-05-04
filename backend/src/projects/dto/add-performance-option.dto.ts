import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddPerformanceOptionDto {
  @IsISO8601()
  proposedDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  proposedTime?: string | null;

  @IsString()
  @MaxLength(50)
  optionStatus: string;
}
