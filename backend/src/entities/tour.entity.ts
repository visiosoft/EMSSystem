import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Tour', schema: 'dbo' })
export class Tour {
  @PrimaryColumn({ name: 'TourID', type: 'int' })
  tourId: number;

  @Column({ name: 'TourName', type: 'nvarchar', length: 200 })
  tourName: string;
}
