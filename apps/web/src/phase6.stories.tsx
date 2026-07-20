import type { Meta, StoryObj } from "@storybook/react-vite";

import { IntegrationPanel } from "./integration/IntegrationPanel.js";
import { integrationFixture } from "./integration/integration-fixtures.js";

const meta = {
  title: "Phase 6/Read-only AgentIntersect integration",
  component: IntegrationPanel,
} satisfies Meta<typeof IntegrationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function readiness(status: "ready" | "offline" | "mismatch") {
  return {
    schema: "aiw.harness-readiness/0.6" as const,
    harness: "codex",
    status,
    observationOnly: true as const,
    executionEnabled: false as const,
    diagnostic: `${status} deterministic Storybook fixture`,
  };
}

export const Ready: Story = {
  args: { state: integrationFixture("ready"), readiness: readiness("ready") },
};

export const OfflineEmpty: Story = {
  args: {
    state: integrationFixture("offline"),
    readiness: readiness("offline"),
  },
};

export const WorkspaceMismatch: Story = {
  args: {
    state: integrationFixture("mismatch"),
    readiness: readiness("mismatch"),
  },
};

export const ReplayedRecovery: Story = {
  args: {
    state: integrationFixture("replayed"),
    readiness: readiness("ready"),
  },
};

export const HostileDataRedacted: Story = {
  args: {
    state: integrationFixture("hostile"),
    readiness: readiness("ready"),
  },
};
