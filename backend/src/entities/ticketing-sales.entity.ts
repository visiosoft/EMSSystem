import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'TicketingSales', schema: 'dbo' })
export class TicketingSales {
  @PrimaryColumn({ name: 'PerformanceID', type: 'int' })
  performanceId: number;

  @PrimaryColumn({ name: 'SalesDate', type: 'date' })
  salesDate: string;

  @Column({ name: 'PerformanceSalesQuantity', type: 'int', nullable: true })
  performanceSalesQuantity: number | null;

  @Column({
    name: 'PerformanceSalesRevenue',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  performanceSalesRevenue: number | null;
}
