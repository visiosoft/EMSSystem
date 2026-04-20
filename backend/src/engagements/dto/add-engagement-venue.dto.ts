import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AddEngagementVenueDto {
  @IsInt()
  @Min(1)
  venueCompanyId: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
