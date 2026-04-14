import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Partial update for dbo.Venue (additional profile fields beyond defaults at registration). */
export class UpdateVenueProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  seatingCapacity?: number;

  /** Decimal string as stored in SQL Server */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  salesTaxRate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  taxInCart?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  insuranceLanguage?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  insurancePolicyCopyRequirements?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  venueRelationshipIae?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  venueTypeId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  seatingTypeId?: number | null;
}
