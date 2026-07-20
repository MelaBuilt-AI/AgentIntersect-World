import type { Meta, StoryObj } from "@storybook/react-vite";

import { EvidencePanel } from "./evidence/EvidencePanel.js";
import { PHASE8_EVIDENCE_FIXTURE } from "./evidence/evidence-fixtures.js";

const meta = {
  title: "Phase 8/Evidence and construction truth",
  component: EvidencePanel,
  args: {
    evidence: PHASE8_EVIDENCE_FIXTURE,
    onSelectObject: () => undefined,
  },
} satisfies Meta<typeof EvidencePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentAndPrevious: Story = {};

export const ReducedMotionEquivalent: Story = {
  parameters: { reducedMotion: "reduce" },
};

export const Empty: Story = {
  args: { evidence: { current: null, previous: null } },
};
