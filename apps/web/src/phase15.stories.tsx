import type { Meta, StoryObj } from "@storybook/react-vite";

import { VoiceJourneyExperience } from "./voice/VoiceJourneyPanel.js";
import { PHASE15_VOICE_FIXTURE } from "./voice/voice-fixtures.js";

const noop = () => undefined;

const meta = {
  title: "Phase 15/Voice Journey",
  component: VoiceJourneyExperience,
} satisfies Meta<typeof VoiceJourneyExperience>;
export default meta;
type Story = StoryObj<typeof meta>;

const render: NonNullable<Story["render"]> = (args) => (
  <VoiceJourneyExperience {...args} />
);

const base = {
  render,
  args: {
    state: PHASE15_VOICE_FIXTURE,
    onAction: noop,
    onTranscript: noop,
  },
} satisfies Story;

export const ProviderUnavailable: Story = {
  ...base,
  args: {
    ...base.args,
    state: {
      ...PHASE15_VOICE_FIXTURE,
      provider: {
        ...PHASE15_VOICE_FIXTURE.provider,
        available: false,
        reason: "Provider staging root is not explicitly configured.",
      },
      captureState: "idle",
      finalTranscript: "",
      status: "Typed text remains available.",
    },
  },
};

export const PermissionDeniedTypedFallback: Story = {
  ...base,
  args: {
    ...base.args,
    state: {
      ...PHASE15_VOICE_FIXTURE,
      browserPermission: "denied",
      captureState: "failed",
      finalTranscript: "",
      status:
        "Browser microphone permission denied. Typed text remains available.",
    },
  },
};

export const ListeningNoLexicalPartial: Story = {
  ...base,
  args: {
    ...base.args,
    state: {
      ...PHASE15_VOICE_FIXTURE,
      captureState: "listening",
      finalTranscript: "",
      status: "Listening from an authoritative capture event.",
    },
  },
};

export const FinalEditable: Story = base;

export const PlaybackInterruptedAfterRecovery: Story = {
  ...base,
  args: {
    ...base.args,
    state: {
      ...PHASE15_VOICE_FIXTURE,
      playback: "stopped",
      recovery: "Previous / recovered · playback interrupted",
      status: "Playback never auto-resumed; canonical captions remain.",
    },
  },
};

export const MobileReducedMotionForcedColorsNoWebGL: Story = {
  ...base,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    media: { reducedMotion: "reduce", forcedColors: "active", webgl: false },
  },
};
