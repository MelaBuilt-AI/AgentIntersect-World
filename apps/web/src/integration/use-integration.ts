import { useEffect, useState } from "react";

import {
  fixtureFromQuery,
  integrationFixture,
} from "./integration-fixtures.js";
import {
  loadHarnessReadiness,
  loadIntegrationState,
} from "./integration-client.js";
import type { HarnessReadiness, IntegrationState } from "./types.js";

export function useIntegration(harness: string) {
  const queryFixture =
    typeof window === "undefined"
      ? null
      : fixtureFromQuery(
          new URLSearchParams(window.location.search).get("fixture"),
        );
  const [remoteState, setRemoteState] = useState<IntegrationState | null>(null);
  const [remoteReadiness, setRemoteReadiness] =
    useState<HarnessReadiness | null>(null);
  const [loading, setLoading] = useState(queryFixture === null);

  useEffect(() => {
    if (queryFixture) {
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const [nextState, nextReadiness] = await Promise.all([
          loadIntegrationState(),
          loadHarnessReadiness(harness),
        ]);
        if (active) {
          setRemoteState(nextState);
          setRemoteReadiness(nextReadiness);
        }
      } catch {
        if (active) {
          setRemoteState(integrationFixture("offline"));
          setRemoteReadiness(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [harness, queryFixture]);

  const fixtureState = queryFixture ? integrationFixture(queryFixture) : null;
  const fixtureReadiness: HarnessReadiness | null = fixtureState
    ? {
        schema: "aiw.harness-readiness/0.6",
        harness,
        status: fixtureState.status,
        observationOnly: true,
        executionEnabled: false,
        diagnostic: `${fixtureState.status} deterministic fixture`,
      }
    : null;
  return {
    state: fixtureState ?? remoteState,
    readiness: fixtureReadiness ?? remoteReadiness,
    loading: queryFixture ? false : loading,
  };
}
