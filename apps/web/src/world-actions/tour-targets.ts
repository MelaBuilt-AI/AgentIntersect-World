export const CANONICAL_TOUR_SOURCE_DIRECTORY = "packages/spatial-code-graph";
export const CANONICAL_TOUR_DESTINATION_DIRECTORY = "packages/renderer-r3f";

export type TourTargetObject = {
  readonly kind: string;
  readonly ref: string;
  readonly path?: string;
};

export type TourPackageTarget = TourTargetObject & {
  readonly kind: "package";
  readonly path: string;
};

export function canonicalPackageDirectory(path: string): string {
  const manifestSuffix = "/package.json";
  return path.endsWith(manifestSuffix)
    ? path.slice(0, -manifestSuffix.length)
    : path;
}

function resolveUniqueCanonicalPackage(
  objects: readonly TourTargetObject[],
  canonicalDirectory: string,
): TourPackageTarget | null {
  const matches = objects.filter(
    (object): object is TourPackageTarget =>
      object.kind === "package" &&
      typeof object.path === "string" &&
      canonicalPackageDirectory(object.path) === canonicalDirectory,
  );

  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function resolveCanonicalTourTargets(
  objects: readonly TourTargetObject[],
): {
  readonly source: TourPackageTarget;
  readonly destination: TourPackageTarget;
} | null {
  const source = resolveUniqueCanonicalPackage(
    objects,
    CANONICAL_TOUR_SOURCE_DIRECTORY,
  );
  const destination = resolveUniqueCanonicalPackage(
    objects,
    CANONICAL_TOUR_DESTINATION_DIRECTORY,
  );

  return source && destination ? { source, destination } : null;
}
