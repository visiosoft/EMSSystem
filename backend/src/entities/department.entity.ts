import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Department', schema: 'dbo' })
export class Department {
  @PrimaryColumn({ name: 'DepartmentID', type: 'int' })
  departmentId: number;

  @Column({ name: 'DepartmentName', type: 'nvarchar', length: 100 })
  departmentName: string;
}
