import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ENGAGEMENT_STATUS_VALUES } from './create-engagement.dto';

export class UpdateEngagementDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(ENGAGEMENT_STATUS_VALUES as unknown as string[])
  engagementStatus?: string;

  /** dbo.Engagement.TourID — optional on update */
  @IsOptional()
  @IsInt()
  @Min(1)
  tourId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  primaryVenueCompanyId?: number;
}
