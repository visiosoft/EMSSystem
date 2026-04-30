import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Company } from './company.entity';

@Entity({ name: 'VenueComplex', schema: 'dbo' })
export class VenueComplex {
  @PrimaryColumn({ name: 'CompanyID', type: 'int' })
  companyId: number;

  @OneToOne(() => Company)
  @JoinColumn({ name: 'CompanyID' })
  company: Company;

  @Column({ name: 'ComplexName', type: 'nvarchar', length: 200 })
  complexName: string;
}
