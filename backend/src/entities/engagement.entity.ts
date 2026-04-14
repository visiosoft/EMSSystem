import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Attraction } from './attraction.entity';
import { Tour } from './tour.entity';

@Entity({ name: 'Engagement', schema: 'dbo' })
export class Engagement {
  @PrimaryGeneratedColumn({ name: 'EngagementID' })
  engagementId: number;

  @Column({ name: 'EngagementStatus', type: 'nvarchar', length: 50 })
  engagementStatus: string;

  @Column({
    name: 'EngagementScaling',
    type: 'nvarchar',
    length: 50,
    nullable: true,
  })
  engagementScaling: string | null;

  @Column({ name: 'AttractionID', type: 'int' })
  attractionId: number;

  @ManyToOne(() => Attraction)
  @JoinColumn({ name: 'AttractionID' })
  attraction: Attraction;

  @Column({ name: 'TourID', type: 'int', nullable: true })
  tourId: number | null;

  @ManyToOne(() => Tour)
  @JoinColumn({ name: 'TourID' })
  tour: Tour | null;
}
