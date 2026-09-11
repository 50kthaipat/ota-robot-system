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
  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith("vercel.app")) {
      return "https://ota-api-omxf.onrender.com";
    }
    return "";
  }
  return process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
};

const BASE_URL = getBaseUrl();

const TOKEN_KEY = "robo_ota_access_token";
const REFRESH_TOKEN_KEY = "robo_ota_refresh_token";

let inMemoryToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

if (typeof window !== "undefined") {
  inMemoryToken = localStorage.getItem(TOKEN_KEY);
  inMemoryRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
}

export const setAccessToken = (token: string | null, refreshToken?: string | null) => {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        inMemoryRefreshToken = refreshToken;
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        inMemoryRefreshToken = null;
      }
    }
  }
};

export const getAccessToken = () => inMemoryToken;
export const getRefreshToken = () => inMemoryRefreshToken;

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

  // Handle 401 Unauthorized by attempting token refresh
  if (res.status === 401 && retry && !url.includes("/api/v1/auth/")) {
    try {
      const refreshHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (inMemoryRefreshToken) {
        refreshHeaders["X-Refresh-Token"] = inMemoryRefreshToken;
      }

      const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: refreshHeaders,
        credentials: "include",
        cache: "no-store",
        body: inMemoryRefreshToken ? JSON.stringify({ refresh_token: inMemoryRefreshToken }) : undefined,
      });

      if (refreshRes.ok) {
        const data: AuthResponse = await refreshRes.json();
        setAccessToken(data.token, data.refresh_token);
        return fetchJSON<T>(url, init, false);
      } else {
        setAccessToken(null, null);
      }
    } catch {
      setAccessToken(null, null);
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
    setAccessToken(res.token, res.refresh_token);
    return res;
  },

  async refresh(): Promise<AuthResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (inMemoryRefreshToken) {
      headers["X-Refresh-Token"] = inMemoryRefreshToken;
    }

    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
      cache: "no-store",
      body: inMemoryRefreshToken ? JSON.stringify({ refresh_token: inMemoryRefreshToken }) : undefined,
    });

    if (!res.ok) {
      setAccessToken(null, null);
      throw new Error("Session expired or refresh failed");
    }

    const data: AuthResponse = await res.json();
    setAccessToken(data.token, data.refresh_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (inMemoryRefreshToken) {
        headers["X-Refresh-Token"] = inMemoryRefreshToken;
      }
      await fetchJSON("/api/v1/auth/logout", {
        method: "POST",
        headers,
      });
    } finally {
      setAccessToken(null, null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("robo_ota_user");
      }
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

    // Explicitly target the Render backend when on Vercel to bypass Vercel's 4.5MB proxy ceiling
    const uploadBase =
      (typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app"))
        ? (process.env.NEXT_PUBLIC_API_URL || "https://ota-api-omxf.onrender.com").replace(/\/$/, "")
        : BASE_URL;

    const res = await fetch(`${uploadBase}/api/v1/firmware/upload`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      let msg = `Upload failed (${res.status} ${res.statusText})`;
      try {
        const d = await res.json();
        if (d.error) msg = d.error;
      } catch {
        try {
          const raw = await res.text();
          if (raw) msg = raw.trim();
        } catch {}
      }
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
