import { useEffect, useRef, useState } from "react";
import { api, ApiError, PdfDocument } from "../lib/api";
import { PaperclipIcon, TrashIcon } from "../components/icons";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await api.getDocuments());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(file, file.name.replace(/\.pdf$/i, ""));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRename(doc: PdfDocument, name: string) {
    setRenamingId(null);
    if (!name.trim() || name === doc.name) return;
    try {
      await api.renameDocument(doc.id, name.trim());
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Rename failed");
    }
  }

  async function handleDelete(doc: PdfDocument) {
    if (!confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed - it may still be attached to a sequence step");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">
            {documents.length} PDF{documents.length === 1 ? "" : "s"} · reusable as attachments across campaign steps
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
          No documents yet. Click "Upload PDF" to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <PaperclipIcon />
              </div>
              <div className="min-w-0 flex-1">
                {renamingId === doc.id ? (
                  <input
                    autoFocus
                    defaultValue={doc.name}
                    onBlur={(e) => handleRename(doc, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-full rounded-md border border-brand-300 px-1.5 py-0.5 text-sm font-medium text-slate-900"
                  />
                ) : (
                  <button
                    onClick={() => setRenamingId(doc.id)}
                    className="truncate text-left text-sm font-medium text-slate-900 hover:underline"
                    title="Click to rename"
                  >
                    {doc.name}
                  </button>
                )}
                <p className="text-xs text-slate-400">{formatSize(doc.sizeBytes)}</p>
              </div>
              <button onClick={() => handleDelete(doc)} className="shrink-0 text-slate-300 hover:text-red-600">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
