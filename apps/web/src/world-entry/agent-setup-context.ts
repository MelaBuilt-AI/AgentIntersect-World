import { createContext } from "react";
import type { AgentSetupState } from "@agentintersect-world/world-schema/agent-setup";
export const AgentSetupContext = createContext<AgentSetupState | null>(null);
