/** Allowed values for `dbo.EngagementProject.ProjectStage` (aligned with DB CHECK). */
export const PROJECT_STAGE_VALUES = [
  'Under Construction',
  'Pending',
  'Inactive',
] as const;
export type ProjectStageValue = (typeof PROJECT_STAGE_VALUES)[number];

export function isAllowedProjectStage(v: string): v is ProjectStageValue {
  return (PROJECT_STAGE_VALUES as readonly string[]).includes(v);
}
