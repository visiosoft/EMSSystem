/**
 * Parse string literals from a SQL Server CHECK definition (e.g. IN (N'a',N'b') or = N'x').
 */
export function parseStringLiteralsFromCheckDefinition(definition: string): string[] {
  const out = new Set<string>();
  const re = /N?'((?:''|[^'])*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(definition)) !== null) {
    const raw = m[1].replace(/''/g, "'");
    if (raw.length > 0) out.add(raw);
  }
  return [...out];
}
