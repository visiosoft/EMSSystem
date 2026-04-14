import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Attraction', schema: 'dbo' })
export class Attraction {
  @PrimaryColumn({ name: 'AttractionID', type: 'int' })
  attractionId: number;

  @Column({ name: 'AttractionName', type: 'nvarchar', length: 200 })
  attractionName: string;

  @Column({ name: 'ClassID', type: 'int' })
  classId: number;

  @Column({ name: 'AttractionManagementLinkID', type: 'int', nullable: true })
  attractionManagementLinkId: number | null;
}
