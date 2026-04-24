import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { CompanyType } from './company-type.entity';
import { Dma } from './dma.entity';

@Entity({ name: 'Company', schema: 'dbo' })
export class Company {
  @PrimaryGeneratedColumn({ name: 'CompanyID' })
  companyId: number;

  @Column({ name: 'CompanyTypeID', type: 'int' })
  companyTypeId: number;

  @ManyToOne(() => CompanyType)
  @JoinColumn({ name: 'CompanyTypeID' })
  companyType: CompanyType;

  @Column({ name: 'CompanyName', type: 'nvarchar', length: 200 })
  companyName: string;

  @Column({ name: 'PhysicalAddressID', type: 'int' })
  physicalAddressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'PhysicalAddressID' })
  physicalAddress: Address;

  @Column({ name: 'MailingAddressID', type: 'int' })
  mailingAddressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'MailingAddressID' })
  mailingAddress: Address;

  @Column({ name: 'DMAID', type: 'int', nullable: true })
  dmaid: number | null;

  @ManyToOne(() => Dma)
  @JoinColumn({ name: 'DMAID' })
  dma: Dma;
}
