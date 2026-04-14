import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'NonResidentWithholding', schema: 'dbo' })
export class NonResidentWithholding {
  @PrimaryColumn({ name: 'WithholdingID', type: 'int' })
  withholdingId: number;

  @Column({
    name: 'WithholdingTaxRate',
    type: 'decimal',
    precision: 18,
    scale: 6,
  })
  withholdingTaxRate: string;
}
