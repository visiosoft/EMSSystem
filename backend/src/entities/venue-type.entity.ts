import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'VenueType', schema: 'dbo' })
export class VenueType {
  @PrimaryColumn({ name: 'VenueTypeID', type: 'int' })
  venueTypeId: number;

  @Column({ name: 'VenueTypeName', type: 'nvarchar', length: 100 })
  venueTypeName: string;
}
