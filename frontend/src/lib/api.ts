import {
  Device,
  FirmwareVersion,
  Deployment,
  DeploymentDevice,
  CreateDeploymentPayload,
  User,
  AuthResponse,
} from "./types";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  return process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
};

const BASE_URL = getBaseUrl();

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const isAuthMutation = url.includes("/login") || url.includes("/refresh") || url.includes("/logout");
  if (response.status === 401 && retry && !isAuthMutation) {
    if (await refreshSession()) return fetchJSON<T>(url, init, false);
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  async getHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        credentials: "include",
        cache: "no-store",
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async login(payload: { username: string; password: string }): Promise<AuthResponse> {
    return fetchJSON<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async refresh(): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Session expired or refresh failed");
    return response.json();
  },

  async logout(): Promise<void> {
    await fetchJSON("/api/v1/auth/logout", { method: "POST" });
  },

  async getMe(): Promise<{ user: User }> {
    return fetchJSON<{ user: User }>("/api/v1/auth/me");
  },

  async getDevices(): Promise<{ data: Device[]; total: number }> {
    return fetchJSON<{ data: Device[]; total: number }>("/api/v1/devices");
  },

  async getDevice(id: string): Promise<Device> {
    return fetchJSON<Device>(`/api/v1/devices/${id}`);
  },

  async deleteDevice(id: string): Promise<{ message: string; id: string }> {
    return fetchJSON<{ message: string; id: string }>(`/api/v1/devices/${id}`, {
      method: "DELETE",
    });
  },

  async pruneOfflineDevices(): Promise<{ message: string; deleted_count: number }> {
    return fetchJSON<{ message: string; deleted_count: number }>("/api/v1/devices/prune-offline", {
      method: "POST",
    });
  },

  async getFirmwares(): Promise<{ data: FirmwareVersion[] }> {
    return fetchJSON<{ data: FirmwareVersion[] }>("/api/v1/firmware");
  },

  async uploadFirmware(formData: FormData): Promise<FirmwareVersion> {
    const response = await fetch(`${BASE_URL}/api/v1/firmware/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      let message = `Upload failed (${response.status} ${response.statusText})`;
      try {
        const data = await response.json();
        if (data.error) message = data.error;
      } catch {}
      throw new Error(message);
    }
    return response.json();
  },

  async getFirmwareDownloadURL(id: string): Promise<{ url: string; checksum: string }> {
    return fetchJSON<{ url: string; checksum: string }>(`/api/v1/firmware/${id}/url`);
  },

  async updateFirmware(id: string, payload: { version?: string; release_notes?: string }): Promise<FirmwareVersion> {
    return fetchJSON<FirmwareVersion>(`/api/v1/firmware/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async deleteFirmware(id: string): Promise<{ message: string; id: string; mode: string }> {
    return fetchJSON<{ message: string; id: string; mode: string }>(`/api/v1/firmware/${id}`, {
      method: "DELETE",
    });
  },

  async getDeployments(): Promise<{ data: Deployment[] }> {
    return fetchJSON<{ data: Deployment[] }>("/api/v1/deployments");
  },

  async getDeployment(id: string): Promise<{ deployment: Deployment; devices: DeploymentDevice[]; target_version?: string }> {
    return fetchJSON<{ deployment: Deployment; devices: DeploymentDevice[]; target_version?: string }>(`/api/v1/deployments/${id}`);
  },

  async createDeployment(payload: CreateDeploymentPayload): Promise<{ id: string; status: string; total_devices: number }> {
    return fetchJSON<{ id: string; status: string; total_devices: number }>("/api/v1/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async rollbackDeployment(id: string): Promise<{ status: string; deployment_id: string }> {
    return fetchJSON<{ status: string; deployment_id: string }>(`/api/v1/deployments/${id}/rollback`, {
      method: "POST",
    });
  },
};
