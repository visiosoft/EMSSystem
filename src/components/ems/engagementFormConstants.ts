/**
 * Engagement status values.
 * MUST match `ENGAGEMENT_STATUS_VALUES` in `backend/src/engagements/engagement-status.util.ts`
 * (re-exported from create-engagement.dto) — otherwise the backend returns 400 Bad Request.
 */
export const ENGAGEMENT_STATUS_ENUM = ['Unknown', 'Private', 'Public'] as const;

/** Alias — same list, used for filter chips (subset shown in UI header) */
export const ENGAGEMENT_STATUS_ALL = ENGAGEMENT_STATUS_ENUM;

export type EngagementStatusEnum = (typeof ENGAGEMENT_STATUS_ENUM)[number];