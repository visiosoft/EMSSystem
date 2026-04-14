import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'DMA', schema: 'dbo' })
export class Dma {
  @PrimaryColumn({ name: 'DMAID', type: 'int' })
  dmaid: number;

  @Column({ name: 'MarketName', type: 'nvarchar', length: 200 })
  marketName: string;

  @Column({ name: 'PostalCode', type: 'nvarchar', length: 20 })
  postalCode: string;
}
