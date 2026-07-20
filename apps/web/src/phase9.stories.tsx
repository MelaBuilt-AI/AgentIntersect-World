import type { Meta, StoryObj } from "@storybook/react-vite";

import { PresentationPanel } from "./presentation/PresentationPanel.js";
import { PHASE9_PRESENTATION_FIXTURE } from "./presentation/presentation-fixtures.js";

const meta = {
  title: "Phase 9/Local presentation synchronization",
  component: PresentationPanel,
  args: { state: PHASE9_PRESENTATION_FIXTURE },
} satisfies Meta<typeof PresentationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedTwoViews: Story = {};

export const OfflineNoRoom: Story = {
  args: {
    state: {
      ...PHASE9_PRESENTATION_FIXTURE,
      documentId: null,
      connection: "offline",
      peers: [],
      authoritativeMessage:
        "Index a repository to establish the authoritative presentation room.",
    },
  },
};

export const TrustedLanWarning: Story = {
  args: {
    state: {
      ...PHASE9_PRESENTATION_FIXTURE,
      networkScope: "lan",
      unencryptedLanWarning: true,
    },
  },
};

export const ReducedMotionEquivalent: Story = {
  parameters: { reducedMotion: "reduce" },
};
