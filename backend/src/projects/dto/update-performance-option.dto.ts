import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import { OPTION_STATUS_VALUES } from './create-project.dto';

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
  @IsIn(OPTION_STATUS_VALUES as unknown as string[])
  optionStatus?: string;
}
