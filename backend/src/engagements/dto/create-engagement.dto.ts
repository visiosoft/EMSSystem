import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEngagementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  engagementStatus: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  engagementScaling?: string | null;

  @IsInt()
  @Min(1)
  attractionId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tourId?: number | null;

  /** Venue row exists when `Venue.CompanyID` = this value (primary venue for the engagement). */
  @IsInt()
  @Min(1)
  primaryVenueCompanyId: number;
}
