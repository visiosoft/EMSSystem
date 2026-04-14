import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'EngagementVenue', schema: 'dbo' })
export class EngagementVenue {
  @PrimaryColumn({ name: 'EngagementID', type: 'int' })
  engagementId: number;

  @PrimaryColumn({ name: 'VenueCompanyID', type: 'int' })
  venueCompanyId: number;

  @Column({ name: 'IsPrimary', type: 'bit' })
  isPrimary: boolean;
}
