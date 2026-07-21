import {
  createAvatarProfile,
  DEFAULT_AVATAR_DRAFT,
} from "@agentintersect-world/avatar-system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AvatarBuilder } from "./avatar/AvatarBuilder.js";
import { IdentifyExperience } from "./avatar/IdentifyExperience.js";
import {
  RepositoryWorldEmptyState,
  RepositoryWorldErrorState,
  RepositoryWorldPanel,
} from "./repository/RepositoryWorldPanel.js";
import { DashboardShell } from "./shell/DashboardShell.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const STORY_PROFILE = createAvatarProfile(
  { ...DEFAULT_AVATAR_DRAFT, agentName: "Codex" },
  null,
  "2026-07-20T12:00:00.000Z",
  "avatar_0123456789abcdef0123456789abcdef",
);

const meta = {
  title: "Phase 5/Balanced vertical slice",
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstOpenIdentify: Story = {
  render: () => (
    <IdentifyExperience
      initialProfile={DEFAULT_AVATAR_DRAFT}
      previousProfile={null}
      storageStatus="unconfigured"
      onComplete={() => undefined}
    />
  ),
};

export const AvatarAppearanceBuilder: Story = {
  render: () => (
    <main className="identify-shell identify-shell--builder">
      <AvatarBuilder
        initialProfile={DEFAULT_AVATAR_DRAFT}
        onSave={() => undefined}
      />
    </main>
  ),
};

export const DashboardShellState: Story = {
  render: () => (
    <DashboardShell
      profile={STORY_PROFILE}
      previousProfile={null}
      onProfileDelete={() => undefined}
      onProfileSave={() => undefined}
    />
  ),
};

export const RepositoryIsland: Story = {
  render: () => <RepositoryWorldPanel fixture />,
};

export const SemanticWebGLFallback: Story = {
  render: () => (
    <RepositoryWorldPanel fixture forcedFallback="creation-failed" />
  ),
};

export const EmptyRepositoryState: Story = {
  render: () => (
    <main className="identify-shell">
      <RepositoryWorldEmptyState />
    </main>
  ),
};

export const RepositoryApiError: Story = {
  render: () => (
    <RepositoryWorldErrorState message="Invalid local server response: the World snapshot did not match the expected schema." />
  ),
};
