import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tour } from './tour.entity';

/**
 * dbo.Engagement
 * Columns: EngagementID, EngagementStatus, EngagementScaling (legacy/unused by API), TourID
 * Opening show date/time lives in dbo.Performance (earliest performance for the engagement).
 * NOTE: AttractionID was removed — reach Attraction via TourID → Tour → AttractionID.
 * TourID is NOT NULL (required).
 */
@Entity({ name: 'Engagement', schema: 'dbo' })
export class Engagement {
  @PrimaryGeneratedColumn({ name: 'EngagementID' })
  engagementId: number;

  @Column({ name: 'EngagementStatus', type: 'nvarchar', length: 50 })
  engagementStatus: string;

  @Column({ name: 'EngagementScaling', type: 'nvarchar', length: 50, nullable: true })
  engagementScaling: string | null;

  /** FK → Tour.TourID — NOT NULL in DB */
  @Column({ name: 'TourID', type: 'int' })
  tourId: number;

  @ManyToOne(() => Tour)
  @JoinColumn({ name: 'TourID' })
  tour: Tour;
}
