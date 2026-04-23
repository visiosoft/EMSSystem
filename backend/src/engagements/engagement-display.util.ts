/**
 * Single-line label for an engagement: matches the main Engagements list column.
 * Venue is the primary venue’s company/venue name, or "TBD" if missing.
 */
export function buildEngagementDisplayTitle(
  attractionName: string | null,
  tourName: string,
  venueLabel: string,
): string {
  if (!attractionName) return `${tourName} @ ${venueLabel}`;
  return `${attractionName} — ${tourName} @ ${venueLabel}`;
}
