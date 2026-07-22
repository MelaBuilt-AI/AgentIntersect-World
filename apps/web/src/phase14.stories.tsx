import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  PHASE14_JOURNEY_FIXTURE,
  Phase14JourneyExperience,
  type Phase14JourneyState,
} from "./phase14/Phase14JourneyPanel.js";

const noop = () => undefined;

const meta = {
  title: "Phase 14/Approved Tool Journey",
  component: Phase14JourneyExperience,
} satisfies Meta<typeof Phase14JourneyExperience>;
export default meta;
type Story = StoryObj<typeof meta>;

const render: NonNullable<Story["render"]> = (args) => (
  <Phase14JourneyExperience {...args} />
);

const active = (
  step: number,
  overrides: Partial<Phase14JourneyState> = {},
): Phase14JourneyState => ({
  ...PHASE14_JOURNEY_FIXTURE,
  status: "active",
  step,
  ...overrides,
});

export const ApprovalPending: Story = {
  render,
  args: {
    state: active(4, {
      approval: null,
      test: null,
      preview: null,
      evidenceRefs: PHASE14_JOURNEY_FIXTURE.evidenceRefs.slice(0, 1),
    }),
    message: "Exact diff is awaiting explicit single-use approval.",
    onAction: noop,
  },
};

export const TestRunning: Story = {
  render,
  args: {
    state: active(8, {
      test: {
        ...(PHASE14_JOURNEY_FIXTURE.test as NonNullable<
          Phase14JourneyState["test"]
        >),
        state: "running",
        exitCode: null,
      },
      preview: null,
    }),
    busy: true,
    message: "The exact allowlisted Node test is running.",
    onAction: noop,
  },
};

export const PreviewReady: Story = {
  render,
  args: {
    state: active(9, {
      preview: {
        ...(PHASE14_JOURNEY_FIXTURE.preview as NonNullable<
          Phase14JourneyState["preview"]
        >),
        state: "ready",
        portClosed: false,
      },
    }),
    message: "Strict loopback health is ready; Stop preview is available.",
    onAction: noop,
  },
};

export const CompleteCorrelatedJourney: Story = {
  render,
  args: {
    state: PHASE14_JOURNEY_FIXTURE,
    message: "All exact evidence is correlated and the owned port is closed.",
    onAction: noop,
  },
};

export const FailedAndRecoverable: Story = {
  render,
  args: {
    state: {
      ...PHASE14_JOURNEY_FIXTURE,
      status: "failed",
      step: 4,
      explanation: {
        ...(PHASE14_JOURNEY_FIXTURE.explanation as NonNullable<
          Phase14JourneyState["explanation"]
        >),
        continuity: {
          state: "stale",
          reason:
            "The exact source hash no longer matches the inspected revision.",
        },
      },
      test: null,
      preview: null,
    },
    message:
      "Mutation failed closed; dirty source is preserved and chat remains usable.",
    onAction: noop,
  },
};

export const MobileReducedMotionForcedColorsNoWebGL: Story = {
  render,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    media: {
      reducedMotion: "reduce",
      forcedColors: "active",
      webgl: false,
    },
  },
  args: {
    state: PHASE14_JOURNEY_FIXTURE,
    message:
      "Semantic DOM contains every control and result without WebGL or motion.",
    onAction: noop,
  },
};
