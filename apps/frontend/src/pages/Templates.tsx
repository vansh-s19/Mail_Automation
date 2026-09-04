import { useEffect, useState } from "react";
import { api, ApiError, Template, TemplateInput } from "../lib/api";
import { DocumentIcon } from "../components/icons";

const MERGE_TAGS = ["{{name}}", "{{title}}", "{{company}}", "{{location}}"];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTemplates(await api.getTemplates());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(t: Template) {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    try {
      await api.deleteTemplate(t.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500">{templates.length} templates</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
        >
          Add Template
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
          No templates yet. Click "Add Template" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <DocumentIcon />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{t.name}</h3>
                  <p className="truncate text-xs text-slate-500">{t.subject}</p>
                </div>
              </div>
              <p className="mb-4 line-clamp-3 flex-1 text-sm text-slate-600">
                {t.bodyText ?? t.bodyHtml.replace(/<[^>]+>/g, " ")}
              </p>
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setEditing(t)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyText, setBodyText] = useState(template?.bodyText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const data: TemplateInput = {
      name,
      subject,
      bodyText,
      bodyHtml: bodyText.replace(/\n/g, "<br/>"),
    };
    try {
      if (template) {
        await api.updateTemplate(template.id, data);
      } else {
        await api.createTemplate(data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          {template ? "Edit Template" : "Add Template"}
        </h2>

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Intro, Follow-up 1"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Quick question about {{company}}"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Body</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={7}
          placeholder="Hi {{name}}, ..."
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <div className="mb-4 flex flex-wrap gap-1.5">
          {MERGE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setBodyText((prev) => prev + tag)}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              {tag}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !subject || !bodyText}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
