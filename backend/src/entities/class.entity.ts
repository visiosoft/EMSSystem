import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Class', schema: 'dbo' })
export class Class {
  @PrimaryColumn({ name: 'ClassID', type: 'int' })
  classId: number;

  @Column({ name: 'ClassName', type: 'nvarchar', length: 100 })
  className: string;
}
