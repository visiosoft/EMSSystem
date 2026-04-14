import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateEngagementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  engagementStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  engagementScaling?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  attractionId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tourId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  primaryVenueCompanyId?: number;
}
