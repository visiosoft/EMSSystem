import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ContactInfo } from './contact-info.entity';

@Entity({ name: 'Contact', schema: 'dbo' })
export class Contact {
  @PrimaryGeneratedColumn({ name: 'ContactID' })
  contactId: number;

  @Column({ name: 'ContactInfoID', type: 'int' })
  contactInfoId: number;

  @ManyToOne(() => ContactInfo, { eager: false })
  @JoinColumn({ name: 'ContactInfoID' })
  contactInfo: ContactInfo;
}
