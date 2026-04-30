import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class LoadDockAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  stateProvince: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;
}

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

  /**
   * Optional entertainment complex (dbo.Company with type Entertainment Complex).
   * At most one complex per venue; persisted as one dbo.VenueComplexMember row when set.
   * Empty array clears the link (standalone venue).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  entertainmentComplexCompanyIds?: number[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  ticketingSystem?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2048)
  venueWebsite?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @ValidateNested()
  @Type(() => LoadDockAddressDto)
  loadDockAddress?: LoadDockAddressDto | null;
}
