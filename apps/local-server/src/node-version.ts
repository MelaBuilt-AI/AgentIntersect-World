/** World's runtime schema is pinned to Node 24; fail fast instead of a 500 later. */
export function unsupportedNodeMessage(version: string): string | null {
  return /^v24(?:\.|$)/u.test(version)
    ? null
    : `AgentIntersect World needs Node 24, found ${version}. Use Node 24 (see .nvmrc) and start again.`;
}
