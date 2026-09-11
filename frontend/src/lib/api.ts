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
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? "" : (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000");
};

const BASE_URL = getBaseUrl();

let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAccessToken = () => inMemoryToken;

async function fetchJSON<T>(url: string, init?: RequestInit, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };

  if (inMemoryToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  // Handle 401 Unauthorized by attempting silent token refresh
  if (res.status === 401 && retry && !url.includes("/api/v1/auth/")) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (refreshRes.ok) {
        const data: AuthResponse = await refreshRes.json();
        setAccessToken(data.token);
        return fetchJSON<T>(url, init, false);
      } else {
        setAccessToken(null);
      }
    } catch {
      setAccessToken(null);
    }
  }

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.error) errMsg = data.error;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  getAccessToken,
  setAccessToken,

  async getHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Auth methods
  async login(payload: { username: string; password: string }): Promise<AuthResponse> {
    const res = await fetchJSON<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAccessToken(res.token);
    return res;
  },

  async refresh(): Promise<AuthResponse> {
    const res = await fetchJSON<AuthResponse>("/api/v1/auth/refresh", {
      method: "POST",
    });
    setAccessToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await fetchJSON("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      setAccessToken(null);
    }
  },

  async getMe(): Promise<{ user: User }> {
    return fetchJSON<{ user: User }>("/api/v1/auth/me");
  },

  // Fleet & Devices
  async getDevices(): Promise<{ data: Device[]; total: number }> {
    return fetchJSON<{ data: Device[]; total: number }>("/api/v1/devices");
  },

  async getDevice(id: string): Promise<Device> {
    return fetchJSON<Device>(`/api/v1/devices/${id}`);
  },

  // Firmware management
  async getFirmwares(): Promise<{ data: FirmwareVersion[] }> {
    return fetchJSON<{ data: FirmwareVersion[] }>("/api/v1/firmware");
  },

  async uploadFirmware(formData: FormData): Promise<FirmwareVersion> {
    const headers: Record<string, string> = {};
    if (inMemoryToken) {
      headers["Authorization"] = `Bearer ${inMemoryToken}`;
    }

    const res = await fetch(`${BASE_URL}/api/v1/firmware/upload`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      let msg = "Upload failed";
      try {
        const d = await res.json();
        if (d.error) msg = d.error;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
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

  // Deployments
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
