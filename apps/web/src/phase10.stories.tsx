import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { RepositoryWorldPanel } from "./repository/RepositoryWorldPanel.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta = {
  title: "Phase 10/Focused symbol and dependency lane",
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

export const CurrentDegradedCoverage: Story = {
  render: () => <RepositoryWorldPanel fixture="phase10" />,
};

export const ReducedMotionWebGLFallback: Story = {
  render: () => (
    <RepositoryWorldPanel fixture="phase10" forcedFallback="disabled" />
  ),
};

export const AggregateAndFocusedDependencyBridge: Story = {
  render: () => (
    <RepositoryWorldPanel fixture="phase10" forcedFallback="disabled" />
  ),
};
