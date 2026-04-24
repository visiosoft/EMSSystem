/** Client-confirmed allowed values for `dbo.EngagementProject.ProjectStage`. */
export const PROJECT_STAGE_VALUES = ['Confirmed', 'Pending', 'Inactive'] as const;
export type ProjectStageValue = (typeof PROJECT_STAGE_VALUES)[number];

export function isAllowedProjectStage(v: string): v is ProjectStageValue {
  return (PROJECT_STAGE_VALUES as readonly string[]).includes(v);
}
