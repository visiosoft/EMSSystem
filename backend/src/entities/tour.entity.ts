import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Attraction } from './attraction.entity';
import { Class } from './class.entity';
import { Company } from './company.entity';
import { VenueType } from './venue-type.entity';

@Entity({ name: 'Tour', schema: 'dbo' })
export class Tour {
  @PrimaryGeneratedColumn({ name: 'TourID' })
  tourId: number;

  @Column({ name: 'TourName', type: 'nvarchar', length: 200 })
  tourName: string;

  @Column({
    name: 'AudienceGender',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  audienceGender: string | null;

  @Column({
    name: 'AudienceAgeRange',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  audienceAgeRange: string | null;

  @Column({ name: 'ASCAP', type: 'bit' })
  ascap: boolean;

  @Column({ name: 'BMI', type: 'bit' })
  bmi: boolean;

  @Column({ name: 'SESAC', type: 'bit' })
  sesac: boolean;

  @Column({ name: 'GMR', type: 'bit' })
  gmr: boolean;

  @Column({
    name: 'TourInsuranceLanguage',
    type: 'nvarchar',
    length: 'max',
    nullable: true,
  })
  tourInsuranceLanguage: string | null;

  @Column({ name: 'AttractionID', type: 'int' })
  attractionId: number;

  @ManyToOne(() => Attraction)
  @JoinColumn({ name: 'AttractionID' })
  attraction: Attraction;

  @Column({ name: 'TourManagementCompanyID', type: 'int', nullable: true })
  tourManagementCompanyId: number | null;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'TourManagementCompanyID' })
  tourManagementCompany: Company | null;

  @Column({ name: 'ClassID', type: 'int' })
  classId: number;

  @ManyToOne(() => Class)
  @JoinColumn({ name: 'ClassID' })
  class: Class;

  @Column({ name: 'TechRiderLinkID', type: 'int', nullable: true })
  techRiderLinkId: number | null;

  /** dbo.Link row for tour banner / tile art (join on LinkID). */
  @Column({ name: 'BannerLinkID', type: 'int', nullable: true })
  bannerLinkId: number | null;

  @Column({ name: 'VenueTypePreferenceID', type: 'int', nullable: true })
  venueTypePreferenceId: number | null;

  @ManyToOne(() => VenueType, { nullable: true })
  @JoinColumn({ name: 'VenueTypePreferenceID' })
  venueTypePreference: VenueType | null;
}
