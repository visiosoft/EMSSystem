import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ENGAGEMENT_STATUS_VALUES } from './create-engagement.dto';

export class UpdateEngagementDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(ENGAGEMENT_STATUS_VALUES as unknown as string[])
  engagementStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  engagementScaling?: string | null;

  /** dbo.Engagement.TourID — optional on update */
  @IsOptional()
  @IsInt()
  @Min(1)
  tourId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  primaryVenueCompanyId?: number;

  // Frontend-only
  @IsOptional() bookerId?: string | null;
  @IsOptional() showDate?: string | null;
  @IsOptional() dealType?: string | null;
  @IsOptional() guarantee?: number | null;
  @IsOptional() splitPct?: number | null;
  @IsOptional() breakeven?: number | null;
  @IsOptional() projectedGross?: number | null;
  @IsOptional() projectedMargin?: number | null;
  @IsOptional() overviewNotes?: string | null;
  @IsOptional() workflows?: unknown;
  @IsOptional() cancellationReason?: string | null;
}
