import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'EngagementProjectPerformanceOption', schema: 'dbo' })
export class EngagementProjectPerformanceOption {
  @PrimaryGeneratedColumn({ name: 'EngagementProjectPerformanceOptionID' })
  performanceOptionId: number;

  @Column({ name: 'EngagementProjectID', type: 'int' })
  engagementProjectId: number;

  /** FK → EngagementProjectVenue — ties this date option to a specific venue proposal. */
  @Column({ name: 'EngagementProjectVenueID', type: 'int', nullable: true })
  engagementProjectVenueId: number | null;

  @Column({ name: 'ProposedDate', type: 'date' })
  proposedDate: string;

  @Column({ name: 'ProposedTime', type: 'time', nullable: true })
  proposedTime: string | null;

  @Column({ name: 'OptionStatus', type: 'nvarchar', length: 50 })
  optionStatus: string;
}
