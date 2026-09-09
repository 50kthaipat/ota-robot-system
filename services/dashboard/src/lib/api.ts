import { Device, FirmwareVersion, Deployment, DeploymentDevice, CreateDeploymentPayload } from "./types";

const BASE_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers: {
      "Accept": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

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
  async getHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getDevices(): Promise<{ data: Device[]; total: number }> {
    return fetchJSON<{ data: Device[]; total: number }>("/api/v1/devices");
  },

  async getDevice(id: string): Promise<Device> {
    return fetchJSON<Device>(`/api/v1/devices/${id}`);
  },

  async getFirmwares(): Promise<{ data: FirmwareVersion[] }> {
    return fetchJSON<{ data: FirmwareVersion[] }>("/api/v1/firmware");
  },

  async uploadFirmware(formData: FormData): Promise<FirmwareVersion> {
    const res = await fetch(`${BASE_URL}/api/v1/firmware/upload`, {
      method: "POST",
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
