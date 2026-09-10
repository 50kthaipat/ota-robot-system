"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  HardDriveDownload,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Rocket,
  RefreshCw,
  ShieldCheck,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { FirmwareVersion } from "@/lib/types";

export default function FirmwarePage() {
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Firmware State
  const [editingFw, setEditingFw] = useState<FirmwareVersion | null>(null);
  const [editVersion, setEditVersion] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete Firmware State
  const [deletingFw, setDeletingFw] = useState<FirmwareVersion | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openEditModal = (fw: FirmwareVersion) => {
    setEditingFw(fw);
    setEditVersion(fw.version);
    setEditNotes(fw.release_notes || "");
    setUpdateError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFw) return;
    if (!editVersion.trim()) {
      setUpdateError("Version tag is required");
      return;
    }
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await api.updateFirmware(editingFw.id, {
        version: editVersion.trim(),
        release_notes: editNotes.trim(),
      });
      setUploadSuccess(`Firmware v${editVersion} updated successfully`);
      setEditingFw(null);
      await loadFirmwares();
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update firmware");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFw) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteFirmware(deletingFw.id);
      setUploadSuccess(`Firmware v${deletingFw.version} deleted successfully`);
      setDeletingFw(null);
      await loadFirmwares();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete firmware");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadFirmwares = async () => {
    try {
      const res = await api.getFirmwares();
      setFirmwares(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirmwares();
  }, []);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError("Please select a .bin firmware file");
      return;
    }
    if (!version.trim()) {
      setUploadError("Version string is required (e.g. 1.2.0)");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("version", version.trim());
      formData.append("release_notes", releaseNotes.trim());

      await api.uploadFirmware(formData);
      setUploadSuccess(`Firmware v${version} successfully uploaded and registered!`);
      setFile(null);
      setVersion("");
      setReleaseNotes("");
      loadFirmwares();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload firmware binary");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyChecksum = (checksum: string, id: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await api.getFirmwareDownloadURL(id);
      window.open(res.url, "_blank");
    } catch (err) {
      alert("Failed to get download URL");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <HardDriveDownload className="w-6 h-6 text-cyan-400" />
            Firmware Repository
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Store, sign, and manage OTA binary images for the robot fleet.
          </p>
        </div>

        <button
          onClick={() => loadFirmwares()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Catalog
        </button>
      </div>

      {/* Upload Zone */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-cyan-400" />
          Upload New Firmware Release
        </h3>

        {uploadError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {uploadSuccess}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 text-center cursor-pointer transition bg-slate-900/30 group"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".bin,.tar.gz,.img"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 rounded-full bg-slate-800 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-400 transition">
                <FileCode className="w-6 h-6" />
              </div>
              {file ? (
                <div>
                  <p className="text-sm font-medium text-cyan-400">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-300 font-medium">
                    Drag and drop firmware binary (.bin) here, or <span className="text-cyan-400">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">SHA256 checksum will be computed automatically</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Version Tag <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1.2.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Release Notes / Changelog
              </label>
              <input
                type="text"
                placeholder="e.g. Fixed joint vibration, updated motor limits"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Computing Checksum & Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Publish Firmware Release
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Firmware Catalog Table */}
      <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Available Firmware Releases ({firmwares.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Version</th>
                <th className="px-6 py-3.5">File Size</th>
                <th className="px-6 py-3.5">SHA256 Checksum</th>
                <th className="px-6 py-3.5">Release Notes</th>
                <th className="px-6 py-3.5">Released At</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                    Loading firmware catalog...
                  </td>
                </tr>
              ) : firmwares.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No firmware versions uploaded yet. Upload a .bin file above to begin.
                  </td>
                </tr>
              ) : (
                firmwares.map((fw) => (
                  <tr key={fw.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-cyan-400 flex items-center gap-2">
                        <span>v{fw.version}</span>
                        {fw.ecdsa_signature ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-medium"
                            title={`NIST P-256 Signature: ${fw.ecdsa_signature}`}
                          >
                            <ShieldCheck className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans font-medium">
                            Unsigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{formatBytes(fw.file_size)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 max-w-[140px] truncate" title={fw.sha256_checksum}>
                          {fw.sha256_checksum.slice(0, 16)}...
                        </span>
                        <button
                          onClick={() => handleCopyChecksum(fw.sha256_checksum, fw.id)}
                          className="text-slate-500 hover:text-slate-300 transition"
                          title="Copy Full SHA256"
                        >
                          {copiedId === fw.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-sans max-w-xs truncate">
                      {fw.release_notes || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-sans">
                      {new Date(fw.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-sans whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(fw.id)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                          title="Download Binary via Presigned S3 URL"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Presigned
                        </button>
                        <button
                          onClick={() => openEditModal(fw)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          title="Edit Version Tag & Release Notes"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingFw(fw)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          title="Delete Firmware Release"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <Link
                          href={`/deploy?firmware=${fw.id}`}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        >
                          <Rocket className="w-3.5 h-3.5" /> Deploy
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Firmware Modal */}
      {editingFw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
                Edit Firmware Release
              </h3>
              <button
                onClick={() => setEditingFw(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {updateError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Version Tag <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                  placeholder="e.g. 1.2.0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Release Notes / Changelog
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
                  placeholder="Description of changes and updates..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFw(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Confirm Firmware Deletion
              </h3>
              <button
                onClick={() => setDeletingFw(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete firmware release{" "}
              <span className="font-bold text-white font-mono">v{deletingFw.version}</span>?
            </p>
            <p className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">
              If this version was already deployed in fleet rollouts, it will be safely deactivated to preserve historical audit logs. If unused, its storage object in Cloudflare R2 will also be permanently deleted.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFw(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
