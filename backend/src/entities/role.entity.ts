import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Role', schema: 'dbo' })
export class Role {
  @PrimaryColumn({ name: 'RoleID', type: 'int' })
  roleId: number;

  @Column({ name: 'RoleName', type: 'nvarchar', length: 100 })
  roleName: string;
}
