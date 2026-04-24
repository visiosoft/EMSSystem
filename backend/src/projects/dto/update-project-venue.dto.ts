import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProjectVenueDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  venueStatus?: string;

  // Frontend-only
  @IsOptional() configName?: string | null;
  @IsOptional() dealType?: string | null;
  @IsOptional() guarantee?: number | null;
  @IsOptional() splitPct?: number | null;
  @IsOptional() breakeven?: number | null;
  @IsOptional() marketingCoOp?: number | null;
}
