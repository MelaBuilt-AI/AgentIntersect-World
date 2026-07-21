import {
  createAvatarProfile,
  DEFAULT_AVATAR_DRAFT,
} from "@agentintersect-world/avatar-system";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AvatarBuilder } from "./avatar/AvatarBuilder.js";
import { AvatarPreview } from "./avatar/AvatarPreview.js";
import {
  AvatarPerformanceFixture,
  AvatarRoster,
} from "./avatar/AvatarRoster.js";
import { integrationFixture } from "./integration/integration-fixtures.js";
const profile = createAvatarProfile(
  { ...DEFAULT_AVATAR_DRAFT, agentName: "Codex" },
  null,
  "2026-07-20T12:00:00.000Z",
  "avatar_0123456789abcdef0123456789abcdef",
);
const meta = { title: "Phase 11/Modular avatars" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const EditorAllSelectors: Story = {
  render: () => (
    <main className="identify-shell identify-shell--builder">
      <AvatarBuilder
        initialProfile={profile}
        currentProfile={profile}
        previousProfile={null}
        storageStatus="saved"
        onSave={() => undefined}
        onDelete={() => undefined}
      />
    </main>
  ),
};
export const Human3D: Story = {
  render: () => <AvatarPreview profile={profile} action="Work" />,
};
export const Dog3D: Story = {
  render: () => (
    <AvatarPreview
      profile={{
        ...profile,
        species: "dog",
        head: "husky",
        hands: "paws",
        feet: "paws",
        fur: "short",
        tail: "dog-curled",
        markings: "mask",
        shirt: "Claude",
      }}
      action="Walk"
    />
  ),
};
export const CatReducedMotion: Story = {
  render: () => (
    <AvatarPreview
      profile={{
        ...profile,
        species: "cat",
        head: "bengal",
        hands: "clawed-paws",
        feet: "clawed-paws",
        fur: "long",
        tail: "cat-curled",
        markings: "socks",
        shirt: "Hermes",
      }}
      action="Offline"
      animate={false}
    />
  ),
};
export const TextOnlyFallback: Story = {
  render: () => <AvatarPreview profile={profile} textOnly />,
};
export const SixtyFourRowRoster: Story = {
  render: () => {
    const state = integrationFixture("phase11-performance");
    return (
      <>
        <AvatarPerformanceFixture profile={profile} />
        <AvatarRoster
          roster={state.projection.roster}
          integrationStatus="ready"
          profile={profile}
          onProfileSave={() => undefined}
        />
      </>
    );
  },
};
