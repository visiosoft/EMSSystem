/** Allowed values for dbo.Engagement.EngagementStatus in this API. */
export const ENGAGEMENT_STATUS_VALUES = ['Unknown', 'Private', 'Public'] as const;

export type EngagementStatusCanonical = (typeof ENGAGEMENT_STATUS_VALUES)[number];

/**
 * Maps legacy DB values to one of the canonical statuses for API responses.
 */
export function normalizeEngagementStatus(raw: string): EngagementStatusCanonical {
  const s = raw.trim();
  if (s === 'Unknown' || s === 'Private' || s === 'Public') return s;
  return 'Unknown';
}
