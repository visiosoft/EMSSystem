import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'CompanyType', schema: 'dbo' })
export class CompanyType {
  @PrimaryColumn({ name: 'CompanyTypeID', type: 'int' })
  companyTypeId: number;

  @Column({ name: 'CompanyTypeName', type: 'nvarchar', length: 100 })
  companyTypeName: string;
}
