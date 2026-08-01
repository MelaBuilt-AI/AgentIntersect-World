import { lazy, Suspense, type ComponentProps, type ComponentType } from "react";

import type { AvatarBuilder as EagerAvatarBuilder } from "./AvatarBuilder.js";

export type AvatarBuilderProps = ComponentProps<typeof EagerAvatarBuilder>;

const LazyAvatarBuilder = lazy(() =>
  import("./AvatarBuilder.js").then(({ AvatarBuilder }) => ({
    default: AvatarBuilder,
  })),
);

export function AvatarBuilderLoader({
  component: Builder = LazyAvatarBuilder,
  ...props
}: AvatarBuilderProps & {
  readonly component?: ComponentType<AvatarBuilderProps>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading complete avatar builder…</p>}>
      <Builder {...props} />
    </Suspense>
  );
}
