import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ApiError, CampaignDetail as CampaignDetailType, Template, Contact, SequenceStep } from "../lib/api";
import { ArrowLeftIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon } from "../components/icons";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-brand-50 text-brand-700",
  archived: "bg-slate-100 text-slate-400",
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, t, contacts] = await Promise.all([api.getCampaign(id), api.getTemplates(), api.getContacts()]);
      setCampaign(c);
      setTemplates(t);
      setAllContacts(contacts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="py-10 text-center text-slate-400">Loading...</div>;
  if (error || !campaign) return <div className="text-sm text-red-600">{error ?? "Campaign not found"}</div>;

  async function handleAddStep() {
    if (!id || templates.length === 0) return;
    try {
      await api.addStep(id, { templateId: templates[0].id, delayDays: 0, delayHours: 0 });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to add step");
    }
  }

  async function handleStepChange(step: SequenceStep, data: Partial<{ templateId: string; delayDays: number; delayHours: number }>) {
    try {
      await api.updateStep(step.id, data);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update step");
    }
  }

  async function handleDeleteStep(step: SequenceStep) {
    if (!confirm(`Remove step ${step.stepOrder + 1} (${step.template.name})?`)) return;
    try {
      await api.deleteStep(step.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to remove step");
    }
  }

  async function handleMoveStep(index: number, direction: -1 | 1) {
    if (!id || !campaign) return;
    const steps = [...campaign.steps];
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    try {
      await api.reorderSteps(id, steps.map((s) => s.id));
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to reorder steps");
    }
  }

  async function handleSaveRules(rules: CampaignDetailType["sendingRules"]) {
    if (!id) return;
    try {
      await api.updateCampaign(id, { sendingRules: rules });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to save sending rules");
    }
  }

  async function handleStatusAction(action: "launch" | "pause" | "resume") {
    if (!id) return;
    try {
      if (action === "launch") await api.launchCampaign(id);
      if (action === "pause") await api.pauseCampaign(id);
      if (action === "resume") await api.resumeCampaign(id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function handleDuplicate() {
    if (!id) return;
    try {
      const copy = await api.duplicateCampaign(id);
      navigate(`/campaigns/${copy.id}`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Duplicate failed");
    }
  }

  async function handleRemoveContact(contactId: string) {
    if (!id) return;
    try {
      await api.unenrollContact(id, contactId);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to remove contact");
    }
  }

  const enrolledIds = new Set(campaign.campaignContacts.map((cc) => cc.contactId));

  return (
    <div>
      <button
        onClick={() => navigate("/campaigns")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Campaigns
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{campaign.name}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[campaign.status]}`}>
            {campaign.status}
          </span>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <button
              onClick={() => handleStatusAction("launch")}
              disabled={campaign.steps.length === 0}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-40"
            >
              Launch
            </button>
          )}
          {campaign.status === "active" && (
            <button
              onClick={() => handleStatusAction("pause")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Pause
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => handleStatusAction("resume")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Resume
            </button>
          )}
          <button
            onClick={handleDuplicate}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Duplicate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Sequence builder */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Sequence</h2>
              <button
                onClick={handleAddStep}
                disabled={templates.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add Step
              </button>
            </div>

            {templates.length === 0 && (
              <p className="mb-3 text-xs text-amber-700">Create a template first before adding sequence steps.</p>
            )}

            {campaign.steps.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No steps yet.</p>
            ) : (
              <div className="space-y-3">
                {campaign.steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                        onClick={() => handleMoveStep(index, -1)}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        onClick={() => handleMoveStep(index, 1)}
                        disabled={index === campaign.steps.length - 1}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDownIcon />
                      </button>
                    </div>

                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          {index + 1}
                        </span>
                        {index === 0 ? "Sent on enrollment" : "Wait, then send"}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={step.templateId}
                          onChange={(e) => handleStepChange(step, { templateId: e.target.value })}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        {index > 0 && (
                          <>
                            <span className="text-sm text-slate-400">after</span>
                            <input
                              type="number"
                              min={0}
                              value={step.delayDays}
                              onChange={(e) => handleStepChange(step, { delayDays: Number(e.target.value) })}
                              className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                            <span className="text-sm text-slate-400">days</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button onClick={() => handleDeleteStep(step)} className="text-slate-300 hover:text-red-600">
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sending rules */}
          <SendingRulesForm rules={campaign.sendingRules} onSave={handleSaveRules} />
        </div>

        {/* Contacts */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Contacts ({campaign.campaignContacts.length})</h2>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {campaign.campaignContacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No contacts enrolled yet. Add contacts manually - syncing from the sheet never auto-enrolls.
            </p>
          ) : (
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {campaign.campaignContacts.map((cc) => (
                <div key={cc.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{cc.contact.name ?? cc.contact.email}</p>
                    <p className="truncate text-xs text-slate-400">{cc.contact.company ?? cc.contact.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveContact(cc.contactId)}
                    className="shrink-0 text-slate-300 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pickerOpen && id && (
        <ContactPicker
          allContacts={allContacts}
          enrolledIds={enrolledIds}
          onClose={() => setPickerOpen(false)}
          onEnroll={async (contactIds) => {
            await api.enrollContacts(id, contactIds);
            setPickerOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SendingRulesForm({
  rules,
  onSave,
}: {
  rules: CampaignDetailType["sendingRules"];
  onSave: (rules: CampaignDetailType["sendingRules"]) => Promise<void>;
}) {
  const [dailySendCap, setDailySendCap] = useState(rules.dailySendCap);
  const [businessHoursStart, setBusinessHoursStart] = useState(rules.businessHoursStart);
  const [businessHoursEnd, setBusinessHoursEnd] = useState(rules.businessHoursEnd);
  const [weekendsEnabled, setWeekendsEnabled] = useState(rules.weekendsEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    dailySendCap !== rules.dailySendCap ||
    businessHoursStart !== rules.businessHoursStart ||
    businessHoursEnd !== rules.businessHoursEnd ||
    weekendsEnabled !== rules.weekendsEnabled;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave({ dailySendCap, businessHoursStart, businessHoursEnd, weekendsEnabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const hourOptions = Array.from({ length: 24 }, (_, h) => h);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-900">Sending Rules</h2>
      <p className="mb-4 text-xs text-slate-400">
        Send time is computed in each contact's own local timezone - e.g. 10 AM here means 10 AM for them, wherever they are.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Daily send cap</label>
          <input
            type="number"
            min={1}
            value={dailySendCap}
            onChange={(e) => setDailySendCap(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={weekendsEnabled}
              onChange={(e) => setWeekendsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
            />
            Send on weekends
          </label>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Business hours start (local)</label>
          <select
            value={businessHoursStart}
            onChange={(e) => setBusinessHoursStart(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Business hours end (local)</label>
          <select
            value={businessHoursEnd}
            onChange={(e) => setBusinessHoursEnd(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Sending Rules"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </section>
  );
}

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

function ContactPicker({
  allContacts,
  enrolledIds,
  onClose,
  onEnroll,
}: {
  allContacts: Contact[];
  enrolledIds: Set<string>;
  onClose: () => void;
  onEnroll: (contactIds: string[]) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const available = allContacts.filter((c) => !enrolledIds.has(c.id));
  const filtered = available.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex h-[600px] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Add Contacts</h2>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, or email..."
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No contacts found.</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name ?? c.email}</p>
                  <p className="truncate text-xs text-slate-400">{c.company ?? c.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-between border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                await onEnroll(Array.from(selected));
                setSaving(false);
              }}
              disabled={selected.size === 0 || saving}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Selected"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
