/**
 * Derive allowed string literals for dbo.EngagementProject.ProjectStage
 * from sys.check_constraints.definition (OR / IN list style CHECKs on SQL Server).
 */
export function parseStringLiteralsFromCheckDefinition(definition: string | null | undefined): string[] {
  if (!definition || typeof definition !== 'string') return [];
  const out = new Set<string>();
  // e.g. ([ProjectStage]='a' OR [ProjectStage]=N'b')  or  [ProjectStage] = 'a'
  const re = /=\s*(?:N)?'((?:''|[^'])*)'/g;
  let m: RegExpExecArray | null;
  const d = definition;
  while ((m = re.exec(d)) !== null) {
    const s = m[1].replace(/''/g, "'");
    if (s.length > 0) out.add(s);
  }
  // IN ( ... ) — may span lines; there can be more than one IN( ) in a CHECK
  const inRe = /\bIN\s*\(([\s\S]*?)\)/gi;
  let inMatch: RegExpExecArray | null;
  while ((inMatch = inRe.exec(d)) !== null) {
    const inner = inMatch[1];
    const re2 = /(?:N)?'((?:''|[^'])*)'/g;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(inner)) !== null) {
      const s = m2[1].replace(/''/g, "'");
      if (s.length > 0) out.add(s);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
