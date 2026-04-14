import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { Company } from './company.entity';
import { NonResidentWithholding } from './non-resident-withholding.entity';
import { SeatingType } from './seating-type.entity';
import { VenueType } from './venue-type.entity';

@Entity({ name: 'Venue', schema: 'dbo' })
export class Venue {
  @PrimaryColumn({ name: 'CompanyID', type: 'int' })
  companyId: number;

  @OneToOne(() => Company)
  @JoinColumn({ name: 'CompanyID' })
  company: Company;

  @Column({ name: 'VenueName', type: 'nvarchar', length: 200 })
  venueName: string;

  @Column({ name: 'SeatingCapacity', type: 'int' })
  seatingCapacity: number;

  @Column({
    name: 'SalesTaxRate',
    type: 'decimal',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  salesTaxRate: string | null;

  @Column({ name: 'TaxInCart', type: 'bit' })
  taxInCart: boolean;

  @Column({ name: 'InsuranceLanguage', type: 'text', nullable: true })
  insuranceLanguage: string | null;

  @Column({
    name: 'InsurancePolicyCopyRequirements',
    type: 'text',
    nullable: true,
  })
  insurancePolicyCopyRequirements: string | null;

  @Column({ name: 'VenueRelationshipIAE', type: 'nvarchar', length: 100 })
  venueRelationshipIae: string;

  @Column({ name: 'VenueTypeID', type: 'int', nullable: true })
  venueTypeId: number | null;

  @ManyToOne(() => VenueType)
  @JoinColumn({ name: 'VenueTypeID' })
  venueType: VenueType | null;

  @Column({ name: 'SeatingTypeID', type: 'int', nullable: true })
  seatingTypeId: number | null;

  @ManyToOne(() => SeatingType)
  @JoinColumn({ name: 'SeatingTypeID' })
  seatingType: SeatingType | null;

  @Column({ name: 'LoadDockAddressID', type: 'int', nullable: true })
  loadDockAddressId: number | null;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'LoadDockAddressID' })
  loadDockAddress: Address | null;

  @Column({ name: 'NonResidentWithholdingID', type: 'int', nullable: true })
  nonResidentWithholdingId: number | null;

  @ManyToOne(() => NonResidentWithholding)
  @JoinColumn({ name: 'NonResidentWithholdingID' })
  nonResidentWithholding: NonResidentWithholding | null;
}
