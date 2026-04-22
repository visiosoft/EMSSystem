import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const VENUE_STATUS_VALUES = [
  'Proposed',
  'Offered',
  'Accepted',
  'Declined',
  'Cancelled',
] as const;

export const OPTION_STATUS_VALUES = [
  'Proposed',
  'Confirmed',
  'Declined',
  'Countered',
] as const;

export class CreatePerformanceOptionDto {
  @IsISO8601()
  proposedDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  proposedTime?: string | null;

  @IsString()
  @IsIn(OPTION_STATUS_VALUES as unknown as string[])
  optionStatus: string;
}

export class CreateProjectVenueDto {
  @IsInt()
  @Min(1)
  venueCompanyId: number;

  @IsString()
  @IsIn(VENUE_STATUS_VALUES as unknown as string[])
  venueStatus: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePerformanceOptionDto)
  performanceOptions?: CreatePerformanceOptionDto[];

  // Frontend-only fields — accepted and silently ignored (Option A per §5.8)
  @IsOptional() configName?: string | null;
  @IsOptional() dealType?: string | null;
  @IsOptional() guarantee?: number | null;
  @IsOptional() splitPct?: number | null;
  @IsOptional() breakeven?: number | null;
  @IsOptional() marketingCoOp?: number | null;
}

export class CreateProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourId: number;

  @IsString()
  @MaxLength(50)
  projectStage: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  createdBy?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectVenueDto)
  venues?: CreateProjectVenueDto[];

  /** Optional list of dbo.DMA.DMAID values — accepted for API parity; not persisted until a DB column exists. */
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  dmaIds?: number[];

  // Frontend-only fields — accepted and silently ignored (Option A per §5.8)
  @IsOptional() name?: string | null;
  @IsOptional() bookerId?: string | null;
  @IsOptional() agentContactId?: string | null;
  @IsOptional() targetOnSale?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;
}
