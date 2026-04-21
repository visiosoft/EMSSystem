import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tour } from './tour.entity';

@Entity({ name: 'EngagementProject', schema: 'dbo' })
export class EngagementProject {
  @PrimaryGeneratedColumn({ name: 'EngagementProjectID' })
  engagementProjectId: number;

  @Column({ name: 'TourID', type: 'int' })
  tourId: number;

  @ManyToOne(() => Tour)
  @JoinColumn({ name: 'TourID' })
  tour: Tour;

  @Column({ name: 'ProjectStage', type: 'nvarchar', length: 50 })
  projectStage: string;

  @Column({ name: 'CreatedDate', type: 'datetime2' })
  createdDate: Date;

  @Column({ name: 'CreatedBy', type: 'nvarchar', length: 200, nullable: true })
  createdBy: string | null;
}
