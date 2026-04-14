import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'Address', schema: 'dbo' })
export class Address {
  @PrimaryGeneratedColumn({ name: 'AddressID' })
  addressId: number;

  @Column({ name: 'AddressLine1', type: 'nvarchar', length: 200 })
  addressLine1: string;

  @Column({
    name: 'AddressLine2',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  addressLine2: string | null;

  @Column({ name: 'City', type: 'nvarchar', length: 100 })
  city: string;

  @Column({ name: 'StateProvince', type: 'nvarchar', length: 100 })
  stateProvince: string;

  @Column({ name: 'PostalCode', type: 'nvarchar', length: 20 })
  postalCode: string;

  @Column({ name: 'Country', type: 'nvarchar', length: 100 })
  country: string;
}
