import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ContactInfo', schema: 'dbo' })
export class ContactInfo {
  @PrimaryGeneratedColumn({ name: 'ContactInfoID' })
  contactInfoId: number;

  @Column({ name: 'FirstName', type: 'nvarchar', length: 100 })
  firstName: string;

  @Column({ name: 'LastName', type: 'nvarchar', length: 100 })
  lastName: string;

  @Column({ name: 'Email', type: 'nvarchar', length: 254 })
  email: string;

  @Column({ name: 'CellPhone', type: 'nvarchar', length: 30, nullable: true })
  cellPhone: string | null;

  @Column({ name: 'WorkPhone', type: 'nvarchar', length: 30, nullable: true })
  workPhone: string | null;
}
