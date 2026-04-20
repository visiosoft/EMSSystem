import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'EngagementProjectVenue', schema: 'dbo' })
export class EngagementProjectVenue {
  @PrimaryGeneratedColumn({ name: 'EngagementProjectVenueID' })
  engagementProjectVenueId: number;

  @Column({ name: 'EngagementProjectID', type: 'int' })
  engagementProjectId: number;

  @Column({ name: 'VenueCompanyID', type: 'int' })
  venueCompanyId: number;

  @Column({ name: 'VenueStatus', type: 'nvarchar', length: 50 })
  venueStatus: string;
}
