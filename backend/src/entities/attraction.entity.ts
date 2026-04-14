import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Class } from './class.entity';

@Entity({ name: 'Attraction', schema: 'dbo' })
export class Attraction {
  @PrimaryGeneratedColumn({ name: 'AttractionID' })
  attractionId: number;

  @Column({ name: 'AttractionName', type: 'nvarchar', length: 200 })
  attractionName: string;

  @Column({ name: 'ClassID', type: 'int' })
  classId: number;

  @ManyToOne(() => Class)
  @JoinColumn({ name: 'ClassID' })
  class: Class;

  @Column({ name: 'AttractionManagementLinkID', type: 'int', nullable: true })
  attractionManagementLinkId: number | null;
}
