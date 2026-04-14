import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePerformanceDto {
  /** ISO date `YYYY-MM-DD` */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  performanceDate: string;

  /** Curtain/show time `HH:mm` or `HH:mm:ss` (24h) */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  performanceTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  performanceStatus?: string;
}
