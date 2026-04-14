/** Front-end status values for filters, required record status, and optional engagement status pickers. */
export const ENGAGEMENT_STATUS_ENUM = [
  'Unknown',
  'Draft',
  'Confirmed',
  'OnSale',
  'Settled',
  'Closed',
  'Cancelled',
  'Dead',
] as const;

export type EngagementStatusEnum = (typeof ENGAGEMENT_STATUS_ENUM)[number];
