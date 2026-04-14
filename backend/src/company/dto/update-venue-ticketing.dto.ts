import { IsInt, IsOptional, Min } from 'class-validator';

/** Only dbo.Venue.SeatingTypeID is persisted; other ticketing UI fields are not in the schema. */
export class UpdateVenueTicketingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  seatingTypeId?: number | null;
}
