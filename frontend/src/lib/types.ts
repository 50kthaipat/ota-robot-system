export interface Device {
  id: string;
  name: string;
  factory_id: string;
  hw_model: string;
  current_version: string;
  status: "online" | "offline" | "updating" | "error";
  last_seen: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface FirmwareVersion {
  id: string;
  version: string;
  storage_key: string;
  file_size: number;
  sha256_checksum: string;
  ecdsa_signature?: string | null;
  release_notes?: string | null;
  is_active: boolean;
  uploaded_by?: string | null;
  created_at: string;
}

export interface Deployment {
  id: string;
  firmware_version_id: string;
  firmware_version?: string;
  strategy: "full" | "canary";
  status: "pending" | "running" | "completed" | "failed" | "rolled_back";
  canary_percentage: number;
  current_phase: number;
  total_devices: number;
  success_count: number;
  failure_count: number;
  rollback_threshold: number;
  created_by: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface DeploymentDevice {
  id: string;
  deployment_id: string;
  device_id: string;
  status: "pending" | "downloading" | "installing" | "success" | "failed" | "rolled_back";
  progress: number;
  error_message?: string | null;
  previous_version?: string | null;
  device_name?: string;
  factory_id?: string;
  hw_model?: string;
  created_at: string;
}

export interface CreateDeploymentPayload {
  firmware_id: string;
  strategy?: "full" | "canary";
  hw_model?: string;
  device_ids?: string[];
  rollback_threshold?: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: "admin" | "operator" | "viewer";
}

export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: User;
}
