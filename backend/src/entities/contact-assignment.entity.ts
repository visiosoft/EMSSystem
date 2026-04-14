import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { Contact } from './contact.entity';
import { Department } from './department.entity';
import { Role } from './role.entity';

@Entity({ name: 'ContactAssignment', schema: 'dbo' })
export class ContactAssignment {
  @PrimaryGeneratedColumn({ name: 'ContactAssignmentID' })
  contactAssignmentId: number;

  @Column({ name: 'ContactID', type: 'int' })
  contactId: number;

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'ContactID' })
  contact: Contact;

  @Column({ name: 'CompanyID', type: 'int' })
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'CompanyID' })
  company: Company;

  @Column({ name: 'RoleID', type: 'int' })
  roleId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'RoleID' })
  role: Role;

  @Column({ name: 'DepartmentID', type: 'int' })
  departmentId: number;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'DepartmentID' })
  department: Department;
}
