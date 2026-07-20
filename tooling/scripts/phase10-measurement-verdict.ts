type ScaleMeasurement = {
  readonly sentinelAbsent: boolean;
  readonly ceilings: {
    readonly coldWallPassed: boolean;
    readonly warmWallPassed: boolean | null;
    readonly rssPassed: boolean;
  };
};

export function phase10MeasurementFailures(result: {
  readonly tenThousand: ScaleMeasurement;
  readonly hundredThousand: ScaleMeasurement;
}): string[] {
  const failures: string[] = [];
  const inspect = (label: string, measurement: ScaleMeasurement): void => {
    if (!measurement.ceilings.coldWallPassed)
      failures.push(`${label} cold wall ceiling exceeded`);
    if (measurement.ceilings.warmWallPassed === false)
      failures.push(`${label} warm wall ceiling exceeded`);
    if (!measurement.ceilings.rssPassed)
      failures.push(`${label} RSS ceiling exceeded`);
    if (!measurement.sentinelAbsent)
      failures.push(`${label} execution sentinel exists`);
  };
  inspect("10k", result.tenThousand);
  inspect("100k", result.hundredThousand);
  return failures;
}
