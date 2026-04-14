import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'SeatingType', schema: 'dbo' })
export class SeatingType {
  @PrimaryColumn({ name: 'SeatingTypeID', type: 'int' })
  seatingTypeId: number;

  @Column({ name: 'SeatingName', type: 'nvarchar', length: 100 })
  seatingName: string;
}
