"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { Pagination } from "@/components/Pagination";

export default function FirmwarePage() {
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
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

  const paginatedFirmwares = useMemo(() => {
    return firmwares.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [firmwares, currentPage, pageSize]);

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
          <h2 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2.5">
            <HardDriveDownload className="w-5 h-5 text-primary" />
            Firmware Repository
          </h2>
          <p className="text-xs text-ink-subtle mt-1 tracking-wide">
            Store, sign, and manage OTA binary images for the robot fleet.
          </p>
        </div>

        <button
          onClick={() => loadFirmwares()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-surface-1 hover:bg-surface-2 text-ink-muted border border-hairline hover:border-hairline-strong transition-colors w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5 text-ink-tertiary" />
          Refresh Catalog
        </button>
      </div>

      {/* Upload Zone */}
      <div className="bg-surface-1 p-6 rounded-xl border border-hairline">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-eyebrow mb-4 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-primary" />
          Upload New Firmware Release
        </h3>

        {uploadError && (
          <div className="mb-4 p-3 rounded-md bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-3 rounded-md bg-semantic-success/10 border border-semantic-success/20 text-semantic-success text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {uploadSuccess}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border border-dashed border-hairline hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-surface-2/40 group"
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
              <div className="p-3 rounded-full bg-surface-2 group-hover:bg-primary/15 text-ink-subtle group-hover:text-primary transition-colors">
                <FileCode className="w-6 h-6" />
              </div>
              {file ? (
                <div>
                  <p className="text-sm font-medium text-primary-hover">{file.name}</p>
                  <p className="text-xs text-ink-subtle font-mono mt-0.5">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-ink-muted font-medium">
                    Drag and drop firmware binary (.bin) here, or <span className="text-primary-hover underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-[11px] text-ink-tertiary mt-1">NIST P-256 signature and SHA256 checksum computed automatically</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Version Tag <span className="text-semantic-error">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1.2.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary focus:outline-none focus:border-primary-focus font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Release Notes / Changelog
              </label>
              <input
                type="text"
                placeholder="e.g. Fixed joint vibration, updated motor limits"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary focus:outline-none focus:border-primary-focus transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Computing Checksum & Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Publish Firmware Release
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Firmware Catalog Table */}
      <div className="bg-surface-1 rounded-xl border border-hairline overflow-hidden">
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-eyebrow">
            Available Firmware Releases ({firmwares.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-ink-muted uppercase tracking-wider text-[11px] font-mono border-b border-hairline">
              <tr>
                <th className="px-6 py-3.5">Version</th>
                <th className="px-6 py-3.5">File Size</th>
                <th className="px-6 py-3.5">SHA256 Checksum</th>
                <th className="px-6 py-3.5">Release Notes</th>
                <th className="px-6 py-3.5">Released At</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-tertiary font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Loading firmware catalog...
                  </td>
                </tr>
              ) : firmwares.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-tertiary font-sans">
                    No firmware versions uploaded yet. Upload a .bin file above to begin.
                  </td>
                </tr>
              ) : (
                paginatedFirmwares.map((fw) => (
                  <tr key={fw.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-primary-hover flex items-center gap-2">
                        <span>v{fw.version}</span>
                        {fw.ecdsa_signature ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-semantic-success/10 text-semantic-success border border-semantic-success/20 font-sans font-medium"
                            title={`NIST P-256 Signature: ${fw.ecdsa_signature}`}
                          >
                            <ShieldCheck className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20 font-sans font-medium">
                            Unsigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-ink-subtle">{formatBytes(fw.file_size)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-subtle max-w-[140px] truncate" title={fw.sha256_checksum}>
                          {fw.sha256_checksum.slice(0, 16)}...
                        </span>
                        <button
                          onClick={() => handleCopyChecksum(fw.sha256_checksum, fw.id)}
                          className="text-ink-tertiary hover:text-ink transition-colors"
                          title="Copy Full SHA256"
                        >
                          {copiedId === fw.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-ink-muted font-sans max-w-xs truncate">
                      {fw.release_notes || "—"}
                    </td>
                    <td className="px-6 py-3.5 text-ink-subtle font-sans">
                      {new Date(fw.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(fw.id)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors bg-surface-2 hover:bg-surface-3 text-ink-muted border border-hairline hover:border-hairline-strong"
                          title="Download Binary via Presigned S3 URL"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Presigned
                        </button>
                        <button
                          onClick={() => openEditModal(fw)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors bg-surface-2 hover:bg-surface-3 text-ink-muted border border-hairline hover:border-hairline-strong"
                          title="Edit Version Tag & Release Notes"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingFw(fw)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors bg-semantic-error/10 hover:bg-semantic-error/20 text-semantic-error border border-semantic-error/25"
                          title="Delete Firmware Release"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <Link
                          href={`/deploy?firmware=${fw.id}`}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors bg-primary hover:bg-primary-hover active:bg-primary-focus text-white"
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

        {firmwares.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={firmwares.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Edit Firmware Modal */}
      {editingFw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-xl border border-hairline-strong bg-surface-1 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Edit Firmware Release
              </h3>
              <button
                onClick={() => setEditingFw(null)}
                className="text-ink-tertiary hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {updateError && (
              <div className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Version Tag <span className="text-semantic-error">*</span>
                </label>
                <input
                  type="text"
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md bg-surface-2 border border-hairline text-ink focus:outline-none focus:border-primary-focus font-mono transition-colors"
                  placeholder="e.g. 1.2.0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Release Notes / Changelog
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md bg-surface-2 border border-hairline text-ink focus:outline-none focus:border-primary-focus transition-colors"
                  placeholder="Description of changes and updates..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFw(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-xl border border-hairline-strong bg-surface-1 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h3 className="text-sm font-semibold text-semantic-error flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Confirm Firmware Deletion
              </h3>
              <button
                onClick={() => setDeletingFw(null)}
                className="text-ink-tertiary hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
              </div>
            )}

            <p className="text-xs text-ink-muted leading-relaxed">
              Are you sure you want to delete firmware release{" "}
              <span className="font-semibold text-ink font-mono">v{deletingFw.version}</span>?
            </p>
            <p className="text-[11px] text-ink-subtle bg-surface-2 p-3 rounded-md border border-hairline leading-relaxed">
              If this version was already deployed in fleet rollouts, it will be safely deactivated to preserve historical audit logs. If unused, its storage object in Cloudflare R2 will also be permanently deleted.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFw(null)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-semantic-error hover:bg-semantic-error/90 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
