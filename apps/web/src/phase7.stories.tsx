import type { Meta, StoryObj } from "@storybook/react-vite";

import { CommandIntentPanel } from "./commands/CommandIntentPanel.js";

const meta = {
  title: "Phase 7/Bounded command intent",
  component: CommandIntentPanel,
  args: {
    harness: "codex",
    phaseId: "phase_7",
    commandsEnabled: true,
    fixtureMode: true,
    readiness: {
      schema: "aiw.harness-readiness/0.6",
      harness: "codex",
      status: "ready",
      observationOnly: true,
      executionEnabled: false,
      diagnostic: "Fresh deterministic Phase 7 command fixture",
    },
  },
} satisfies Meta<typeof CommandIntentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};

export const AuthorityDisabled: Story = {
  args: {
    commandsEnabled: false,
    readiness: {
      schema: "aiw.harness-readiness/0.6",
      harness: "codex",
      status: "offline",
      observationOnly: true,
      executionEnabled: false,
      diagnostic: "Command authority is unavailable",
    },
  },
};
