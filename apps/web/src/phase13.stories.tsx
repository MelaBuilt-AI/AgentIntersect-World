import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  PHASE13_WORLD_ACTION_FIXTURE,
  WorldActionExperience,
} from "./world-actions/WorldActionPanel.js";

const meta = {
  title: "Phase 13/Embodied World Actions",
  component: WorldActionExperience,
} satisfies Meta<typeof WorldActionExperience>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EveryActionState: Story = {
  args: { state: PHASE13_WORLD_ACTION_FIXTURE },
};

export const CapabilityDegradation: Story = {
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      capability: {
        enabled: false,
        reason:
          "Structured helper unavailable; persistent chat and manual navigation remain available.",
      },
    },
  },
};

export const FirstPersonPointerLockReady: Story = {
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      navigation: {
        ...PHASE13_WORLD_ACTION_FIXTURE.navigation,
        cameraMode: "first-person",
        pointerLocked: true,
      },
    },
  },
};

export const TourFollowWideFraming: Story = {
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      navigation: {
        ...PHASE13_WORLD_ACTION_FIXTURE.navigation,
        follow: true,
        agentMotion: "moving",
      },
    },
  },
};

export const PhotoCameraOnly: Story = {
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      navigation: {
        ...PHASE13_WORLD_ACTION_FIXTURE.navigation,
        cameraMode: "photo",
        photo: true,
      },
    },
  },
};

export const MobileReducedMotionNoWebGL: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      reducedMotion: true,
      noWebGL: true,
      mobile: true,
      preferences: {
        ...PHASE13_WORLD_ACTION_FIXTURE.preferences,
        easing: 0,
        cosmeticMotion: false,
      },
    },
  },
};

export const AggregateLodTruncatedTruth: Story = {
  args: {
    state: {
      ...PHASE13_WORLD_ACTION_FIXTURE,
      currentStatus:
        "100k aggregate LOD active; one focused-detail area retained.",
    },
  },
};
