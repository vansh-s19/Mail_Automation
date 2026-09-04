const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "mail_automation_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export interface Contact {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  phone: string | null;
  email: string;
  locationRaw: string | null;
  resolvedTimezone: string | null;
  isSuppressed: boolean;
  customFields: Record<string, unknown> | null;
  createdAt: string;
}

export interface ContactFilters {
  search?: string;
  company?: string;
  industry?: string;
  location?: string;
  status?: "active" | "suppressed";
  skip?: number;
  take?: number;
}

export interface ContactFilterOptions {
  companies: string[];
  industries: string[];
  locations: string[];
}

export interface SyncReport {
  new: number;
  updated: number;
  skipped: number;
  invalid: number;
  needsReview: number;
  total: number;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  createdAt: string;
}

export interface TemplateInput {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

export interface SendingRules {
  dailySendCap: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  weekendsEnabled: boolean;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  sendingRules: SendingRules;
  createdAt: string;
  stepCount: number;
  contactCount: number;
}

export interface PdfDocument {
  id: string;
  name: string;
  s3Key: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SequenceStep {
  id: string;
  campaignId: string;
  stepOrder: number;
  templateId: string;
  delayDays: number;
  delayHours: number;
  subjectOverride: string | null;
  sendHour: number | null;
  attachmentId: string | null;
  template: Template;
  attachment: PdfDocument | null;
}

export interface SequenceStepInput {
  templateId: string;
  delayDays: number;
  delayHours: number;
  subjectOverride?: string | null;
  sendHour?: number | null;
  attachmentId?: string | null;
}

export interface StepAutomation {
  id: string;
  sequenceStepId: string;
  triggerType: "opened_no_reply";
  triggerDelayHours: number;
  actionTemplateId: string;
  isActive: boolean;
  actionTemplate: Template;
}

export interface StepAutomationInput {
  triggerType: "opened_no_reply";
  triggerDelayHours: number;
  actionTemplateId: string;
  isActive?: boolean;
}

export interface CampaignDetail {
  id: string;
  name: string;
  status: CampaignStatus;
  sendingRules: SendingRules;
  createdAt: string;
  steps: SequenceStep[];
  campaignContacts: {
    id: string;
    contactId: string;
    state: string;
    enrolledAt: string;
    contact: Contact;
    emailSends: { id: string; currentStatus: string }[];
  }[];
}

export interface DailyQueueRow {
  id: string;
  status: "pending_review" | "approved" | "excluded" | "dispatched";
  targetDate: string;
  scheduledLocalSendTime: string;
  contact: { id: string; name: string | null; email: string; company: string | null; resolvedTimezone: string | null };
  campaign: { id: string; name: string };
  step: { id: string; stepOrder: number; templateName: string; templateSubject: string };
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getContacts: (filters: ContactFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return request<{ contacts: Contact[]; total: number }>(`/contacts${qs ? `?${qs}` : ""}`);
  },
  getContactIds: (filters: Omit<ContactFilters, "skip" | "take"> = {}) => {
    const params = new URLSearchParams({ all: "true" });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return request<{ ids: string[] }>(`/contacts?${params.toString()}`);
  },
  getContactFilterOptions: () => request<ContactFilterOptions>("/contacts/filter-options"),
  syncSheet: () => request<SyncReport>("/contacts/sync-sheet", { method: "POST" }),
  deleteContact: (id: string) => request<void>(`/contacts/${id}`, { method: "DELETE" }),

  getTemplates: () => request<Template[]>("/templates"),
  createTemplate: (data: TemplateInput) =>
    request<Template>("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<TemplateInput>) =>
    request<Template>(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),

  getCampaigns: () => request<CampaignSummary[]>("/campaigns"),
  getCampaign: (id: string) => request<CampaignDetail>(`/campaigns/${id}`),
  createCampaign: (name: string) =>
    request<CampaignSummary>("/campaigns", { method: "POST", body: JSON.stringify({ name }) }),
  updateCampaign: (id: string, data: { name?: string; sendingRules?: Partial<SendingRules> }) =>
    request<CampaignSummary>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  duplicateCampaign: (id: string) => request<CampaignDetail>(`/campaigns/${id}/duplicate`, { method: "POST" }),
  launchCampaign: (id: string) => request<CampaignSummary>(`/campaigns/${id}/launch`, { method: "POST" }),
  pauseCampaign: (id: string) => request<CampaignSummary>(`/campaigns/${id}/pause`, { method: "POST" }),
  resumeCampaign: (id: string) => request<CampaignSummary>(`/campaigns/${id}/resume`, { method: "POST" }),
  archiveCampaign: (id: string) => request<CampaignSummary>(`/campaigns/${id}/archive`, { method: "POST" }),

  addStep: (campaignId: string, data: SequenceStepInput) =>
    request<SequenceStep>(`/campaigns/${campaignId}/steps`, { method: "POST", body: JSON.stringify(data) }),
  updateStep: (stepId: string, data: Partial<SequenceStepInput>) =>
    request<SequenceStep>(`/campaigns/steps/${stepId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStep: (stepId: string) => request<void>(`/campaigns/steps/${stepId}`, { method: "DELETE" }),
  reorderSteps: (campaignId: string, stepIds: string[]) =>
    request<SequenceStep[]>(`/campaigns/${campaignId}/steps/reorder`, {
      method: "POST",
      body: JSON.stringify({ stepIds }),
    }),

  enrollContacts: (campaignId: string, contactIds: string[]) =>
    request<{ enrolled: number; alreadyEnrolled: number }>(`/campaigns/${campaignId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ contactIds }),
    }),
  unenrollContact: (campaignId: string, contactId: string) =>
    request<void>(`/campaigns/${campaignId}/contacts/${contactId}`, { method: "DELETE" }),

  buildDailyQueue: (date?: string) =>
    request<{ date: string; added: number; skipped: number }>(
      `/daily-queue/build${date ? `?date=${date}` : ""}`,
      { method: "POST" }
    ),
  getDailyQueue: (date?: string) =>
    request<{ date: string; rows: DailyQueueRow[] }>(`/daily-queue${date ? `?date=${date}` : ""}`),
  bulkQueueAction: (queueIds: string[], action: "approve" | "exclude") =>
    request<{ updated: number }>("/daily-queue/bulk-action", {
      method: "POST",
      body: JSON.stringify({ queueIds, action }),
    }),

  getDocuments: () => request<PdfDocument[]>("/documents"),
  uploadDocument: async (file: File, name?: string): Promise<PdfDocument> => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    const token = getToken();
    const res = await fetch(`${API_URL}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, body.error ?? "Upload failed");
    }
    return res.json();
  },
  renameDocument: (id: string, name: string) =>
    request<PdfDocument>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),

  getStepAutomations: (stepId: string) => request<StepAutomation[]>(`/campaigns/steps/${stepId}/automations`),
  createStepAutomation: (stepId: string, data: StepAutomationInput) =>
    request<StepAutomation>(`/campaigns/steps/${stepId}/automations`, { method: "POST", body: JSON.stringify(data) }),
  updateStepAutomation: (automationId: string, data: Partial<StepAutomationInput>) =>
    request<StepAutomation>(`/campaigns/automations/${automationId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStepAutomation: (automationId: string) =>
    request<void>(`/campaigns/automations/${automationId}`, { method: "DELETE" }),
  markReplied: (emailSendId: string) => request<void>(`/email-sends/${emailSendId}/mark-replied`, { method: "POST" }),
};

export { ApiError };
