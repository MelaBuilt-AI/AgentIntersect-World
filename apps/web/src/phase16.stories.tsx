import type { Meta, StoryObj } from "@storybook/react-vite";

import { CoordinationPanel } from "./coordination/CoordinationPanel.js";
import { PHASE16_COORDINATION_FIXTURE } from "./coordination/coordination-fixtures.js";

const meta = {
  title: "Phase 16/Two-Agent Coordination",
  component: CoordinationPanel,
} satisfies Meta<typeof CoordinationPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentConflictingCandidate: Story = {
  args: {
    projection: PHASE16_COORDINATION_FIXTURE,
    onAction: () => undefined,
  },
};

export const PreviousRecovered: Story = {
  args: {
    projection: {
      ...PHASE16_COORDINATION_FIXTURE,
      truth: "previous-recovered",
    },
    onAction: () => undefined,
  },
};

export const Unavailable: Story = {
  args: {
    projection: {
      ...PHASE16_COORDINATION_FIXTURE,
      truth: "unavailable",
      revision: null,
      coordinationSessionId: null,
      cancelled: null,
      unavailableReason: "Both checksummed generations are corrupt.",
      agents: [],
      tasks: [],
      worktrees: [],
      contention: [],
      messages: [],
      handoffs: [],
      mergeCandidates: [],
      testEvidence: [],
    },
    onAction: () => undefined,
  },
};

export const MobileReducedMotionForcedColorsNoWebGL: Story = {
  ...CurrentConflictingCandidate,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    media: { reducedMotion: "reduce", forcedColors: "active", webgl: false },
  },
};
