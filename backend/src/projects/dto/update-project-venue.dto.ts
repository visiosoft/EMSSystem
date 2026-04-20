import { IsIn, IsOptional, IsString } from 'class-validator';
import { VENUE_STATUS_VALUES } from './create-project.dto';

export class UpdateProjectVenueDto {
  @IsOptional()
  @IsString()
  @IsIn(VENUE_STATUS_VALUES as unknown as string[])
  venueStatus?: string;

  // Frontend-only
  @IsOptional() configName?: string | null;
  @IsOptional() dealType?: string | null;
  @IsOptional() guarantee?: number | null;
  @IsOptional() splitPct?: number | null;
  @IsOptional() breakeven?: number | null;
  @IsOptional() marketingCoOp?: number | null;
}
