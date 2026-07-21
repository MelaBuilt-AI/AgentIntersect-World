import type { Meta, StoryObj } from "@storybook/react-vite";

import { AgentSessionExperience } from "./sessions/AgentSessionPanel.js";
import {
  PHASE12_OFFLINE_SESSION_FIXTURE,
  PHASE12_SESSION_FIXTURE,
} from "./sessions/session-fixtures.js";

const meta = { title: "Phase 12/Persistent Hermes session" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const actions = {
  onNativeSession: () => undefined,
  onMode: () => undefined,
  onConnect: () => undefined,
  onSend: () => undefined,
  onAvatarDecision: () => undefined,
  onAvatarEdit: () => undefined,
  onAvatarRevoke: () => undefined,
} as const;

export const ConnectedCurrentDesktop: Story = {
  render: () => (
    <AgentSessionExperience state={PHASE12_SESSION_FIXTURE} {...actions} />
  ),
};

export const PreviousRecovered: Story = {
  render: () => (
    <AgentSessionExperience
      state={{
        ...PHASE12_SESSION_FIXTURE,
        continuityLabel: "Previous / recovered",
        lastResult:
          "Recovered last-good World metadata; Hermes re-attestation is required.",
      }}
      {...actions}
    />
  ),
};

export const OfflineCapabilityDegradation: Story = {
  render: () => (
    <AgentSessionExperience
      state={PHASE12_OFFLINE_SESSION_FIXTURE}
      {...actions}
    />
  ),
};

export const MobileReducedMotionNoWebGL: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    backgrounds: { default: "dark" },
  },
  render: () => (
    <div style={{ maxWidth: 390 }}>
      <AgentSessionExperience state={PHASE12_SESSION_FIXTURE} {...actions} />
    </div>
  ),
};
