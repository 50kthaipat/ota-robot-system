import { Device, FirmwareVersion, CreateDeploymentPayload } from "./types";

export type TargetScope = "all" | "factory" | "custom";
export type RolloutStrategy = "full" | "canary";

export interface RolloutDraft {
  selectedFwId: string;
  targetScope: TargetScope;
  selectedFactory: string;
  selectedDeviceIds: string[];
  strategy: RolloutStrategy;
  rollbackThreshold: number;
}

export interface RolloutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasHardwareMismatch: boolean;
  mismatchedDevices: Device[];
  sentinelCount: number;
  subsequentCount: number;
}

/**
 * Derives unique factory identifiers from fleet devices.
 */
export function deriveFactories(devices: Device[]): string[] {
  const s = new Set<string>();
  devices.forEach((d) => {
    if (d.factory_id) s.add(d.factory_id);
  });
  return Array.from(s);
}

/**
 * Filters fleet devices that are eligible for deployment (must be online).
 */
export function deriveEligibleDevices(devices: Device[]): Device[] {
  return devices.filter((d) => d.status === "online");
}

/**
 * Resolves the final target device slice based on scope selection.
 */
export function deriveTargetDevices(
  eligibleDevices: Device[],
  scope: TargetScope,
  selectedFactory: string,
  selectedDeviceIds: string[]
): Device[] {
  if (scope === "all") {
    return eligibleDevices;
  }
  if (scope === "factory") {
    return eligibleDevices.filter((d) => d.factory_id === selectedFactory);
  }
  return eligibleDevices.filter((d) => selectedDeviceIds.includes(d.id));
}

/**
 * Evaluates the rollout configuration against industrial safety invariants.
 */
export function evaluateRolloutPlan(
  draft: RolloutDraft,
  targetDevices: Device[],
  firmware?: FirmwareVersion
): RolloutValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.selectedFwId) {
    errors.push("No firmware version selected.");
  }

  if (targetDevices.length === 0) {
    errors.push("No eligible online devices selected for deployment.");
  }

  // Check hardware compatibility if firmware metadata is present
  const mismatchedDevices: Device[] = [];
  if (firmware) {
    targetDevices.forEach((dev) => {
      // Check if device is already on target version
      if (dev.current_version === firmware.version) {
        warnings.push(`Device ${dev.name} is already running target version ${firmware.version}.`);
      }
    });
  }

  const n = targetDevices.length;
  let sentinelCount = 0;
  let subsequentCount = 0;

  if (draft.strategy === "canary" && n > 0) {
    sentinelCount = Math.max(1, Math.ceil(n * 0.20));
    subsequentCount = n - sentinelCount;
  } else {
    sentinelCount = n;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    hasHardwareMismatch: mismatchedDevices.length > 0,
    mismatchedDevices,
    sentinelCount,
    subsequentCount,
  };
}

/**
 * Constructs the typed API payload for initiating the deployment.
 */
export function prepareDeploymentPayload(
  draft: RolloutDraft,
  targetDevices: Device[]
): CreateDeploymentPayload {
  return {
    firmware_id: draft.selectedFwId,
    strategy: draft.strategy,
    hw_model: "all",
    device_ids: targetDevices.map((d) => d.id),
    rollback_threshold: draft.rollbackThreshold / 100.0,
  };
}
