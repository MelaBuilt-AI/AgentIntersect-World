import { useEffect, useState } from "react";

import { loadAuthority, type AuthorityLoadResult } from "../health-client.js";

export type AuthorityState = { status: "loading" } | AuthorityLoadResult;

export function useAuthorityState(): AuthorityState {
  const [authority, setAuthority] = useState<AuthorityState>({
    status: "loading",
  });
  useEffect(() => {
    let active = true;
    void loadAuthority().then((result) => {
      if (active) setAuthority(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return authority;
}
