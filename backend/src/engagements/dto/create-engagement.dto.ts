import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ENGAGEMENT_STATUS_VALUES } from '../engagement-status.util';

export { ENGAGEMENT_STATUS_VALUES };

export class CreateEngagementDto {
  @IsString()
  @MaxLength(50)
  @IsIn(ENGAGEMENT_STATUS_VALUES as unknown as string[])
  engagementStatus: string;

  /**
   * Opening show — persisted as dbo.Performance (PerformanceDate + PerformanceTime).
   * ISO date YYYY-MM-DD
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  openingShowDate: string;

  /** Curtain time HH:mm or HH:mm:ss (24h) */
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  openingShowTime: string;

  /**
   * dbo.Engagement.TourID — NOT NULL in DB. REQUIRED.
   * Attraction is derived via Tour (Engagement has no AttractionID column).
   */
  @IsInt()
  @Min(1)
  tourId: number;

  /** Creates dbo.EngagementVenue(IsPrimary=1) */
  @IsInt()
  @Min(1)
  primaryVenueCompanyId: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  secondaryVenueCompanyIds?: number[];

  // Frontend-only fields — ignored by DB
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
