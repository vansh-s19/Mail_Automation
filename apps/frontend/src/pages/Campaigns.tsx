import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, CampaignSummary } from "../lib/api";
import { SendIcon, PlusIcon } from "../components/icons";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-brand-50 text-brand-700",
  archived: "bg-slate-100 text-slate-400",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await api.getCampaigns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const campaign = await api.createCampaign(newName.trim());
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to create campaign");
    }
  }

  async function handleDuplicate(c: CampaignSummary) {
    try {
      await api.duplicateCampaign(c.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Duplicate failed");
    }
  }

  async function handlePauseResume(c: CampaignSummary) {
    try {
      if (c.status === "active") await api.pauseCampaign(c.id);
      else if (c.status === "paused") await api.resumeCampaign(c.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function handleLaunch(c: CampaignSummary) {
    try {
      await api.launchCampaign(c.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Launch failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500">{campaigns.length} campaigns</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
        >
          <PlusIcon />
          New Campaign
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400">Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <SendIcon />
          </div>
          <p className="mb-1 font-medium text-slate-700">No campaigns yet</p>
          <p className="text-sm text-slate-400">Create one to start building a sequence.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Steps</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.stepCount}</td>
                  <td className="px-4 py-3 text-slate-600">{c.contactCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {c.status === "draft" && (
                        <button
                          onClick={() => handleLaunch(c)}
                          disabled={c.stepCount === 0}
                          title={c.stepCount === 0 ? "Add at least one step first" : ""}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          Launch
                        </button>
                      )}
                      {(c.status === "active" || c.status === "paused") && (
                        <button
                          onClick={() => handlePauseResume(c)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {c.status === "active" ? "Pause" : "Resume"}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/campaigns/${c.id}`)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(c)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Duplicate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-slate-900">New Campaign</h2>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Automotive Q3 Outreach"
              className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
