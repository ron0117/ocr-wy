import axios from 'axios';
import type { AuthUser, ProductRow, TaskStatus } from '@ocr/shared-types';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ocr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url ?? '');
    if (error.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem('ocr_token');
      if (!location.pathname.startsWith('/login')) location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('；');
    if (typeof message === 'string') return message;
    if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试';
  }
  return fallback;
}

export interface TaskImage {
  id: string;
  pageIndex: number;
  resourceId: string;
  ocrText: string;
  ocrJson: { lines?: Array<{ text: string; confidence: number }> } | null;
  meanConfidence: number | null;
}

export interface ExportItem {
  id: string;
  status: string;
  resourceId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskDetail {
  id: string;
  title: string;
  status: TaskStatus;
  templateId: string | null;
  templateName: string | null;
  sourceCount: number;
  dataVersion: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  images: TaskImage[];
  exports: ExportItem[];
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  templateName: string | null;
  sourceCount: number;
  dataVersion: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ResourceItem {
  id: string;
  type: string;
  contentType: string;
  sizeBytes: string;
  originalName: string | null;
  createdAt: string;
}

export interface ClubItem {
  id: string;
  name: string;
  leader: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberChange {
  direction: 'up' | 'down';
  delta: number;
}

export interface MemberItem {
  id: string;
  clubId: string;
  rank: number;
  playerName: string;
  clubName: string;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
  dataUpdatedAt: string;
  rankChange: MemberChange | null;
  scoreChange: MemberChange | null;
}

export async function listClubs() {
  const { data } = await api.get<ClubItem[]>('/clubs');
  return data;
}

export async function createClub(name: string, leader?: string) {
  const { data } = await api.post<ClubItem>('/clubs', { name, leader: leader || undefined });
  return data;
}

export async function updateClub(clubId: string, payload: { name?: string; leader?: string | null }) {
  const { data } = await api.patch<ClubItem>(`/clubs/${clubId}`, payload);
  return data;
}

export async function deleteClub(clubId: string) {
  await api.delete(`/clubs/${clubId}`);
}

export async function importMembers(clubId: string, files: File[]) {
  const body = new FormData();
  for (const file of files) body.append('files', file);
  const { data } = await api.post<{ rowCount: number; imageCount: number; updatedAt: string }>(
    `/clubs/${clubId}/imports`,
    body,
    { timeout: 600_000 },
  );
  return data;
}

export interface MemberInput {
  clubId: string;
  playerName: string;
  rank: number;
  level?: number | null;
  path?: string | null;
  score?: number | null;
  fashion?: number | null;
  weeklyActivity?: number | null;
  joinedText?: string | null;
}

export async function listMembers(params: { clubId?: string; keyword?: string; sort?: string; order?: 'asc' | 'desc' }) {
  const { data } = await api.get<MemberItem[]>('/members', { params });
  return data;
}

export async function createMember(payload: MemberInput) {
  const { data } = await api.post<MemberItem>('/members', payload);
  return data;
}

export async function updateMember(memberId: string, payload: MemberInput) {
  const { data } = await api.patch<MemberItem>(`/members/${memberId}`, payload);
  return data;
}

export async function deleteMember(memberId: string) {
  await api.delete(`/members/${memberId}`);
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
  return data;
}

export async function register(email: string, password: string, name: string) {
  const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/register', {
    email,
    password,
    name: name || undefined,
  });
  return data;
}

export async function me() {
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}

export async function listTasks() {
  const { data } = await api.get<TaskSummary[]>('/tasks');
  return data;
}

export async function createTask(title: string, templateId?: string) {
  const { data } = await api.post<TaskDetail>('/tasks', { title, templateId: templateId || undefined });
  return data;
}

export async function getTask(taskId: string) {
  const { data } = await api.get<TaskDetail>(`/tasks/${taskId}`);
  return data;
}

export async function uploadImage(taskId: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post(`/tasks/${taskId}/images`, body, { timeout: 60_000 });
  return data;
}

export async function recognize(taskId: string, force = false) {
  const { data } = await api.post<TaskDetail>(`/tasks/${taskId}/recognize`, { force }, { timeout: 120_000 });
  return data;
}

export async function listRecords(taskId: string) {
  const { data } = await api.get<ProductRow[]>(`/tasks/${taskId}/records`);
  return data;
}

export async function saveRecords(taskId: string, rows: ProductRow[]) {
  const { data } = await api.patch<{ dataVersion: number; rows: ProductRow[] }>(`/tasks/${taskId}/records`, {
    rows: rows.map((row) => ({
      rowIndex: row.rowIndex,
      productName: row.productName,
      price: row.price,
      quantity: row.quantity,
      total: row.total,
      unit: row.unit,
      confidence: row.confidence,
      rawText: row.rawText,
      warnings: row.warnings,
    })),
  });
  return data;
}

export async function sendChat(taskId: string, message: string) {
  const { data } = await api.post<{
    message: string;
    dataVersion: number;
    requiresReview: boolean;
    rows: ProductRow[];
  }>(`/tasks/${taskId}/chat`, { message }, { timeout: 120_000 });
  return data;
}

export async function applyTemplate(taskId: string, templateId?: string) {
  const { data } = await api.post<{
    message: string;
    dataVersion: number;
    requiresReview: boolean;
    rows: ProductRow[];
  }>(`/tasks/${taskId}/apply-template`, { templateId }, { timeout: 120_000 });
  return data;
}

export async function listMessages(taskId: string) {
  const { data } = await api.get<ChatMessage[]>(`/tasks/${taskId}/messages`);
  return data;
}

export async function listTemplates() {
  const { data } = await api.get<TemplateItem[]>('/templates');
  return data;
}

export async function createTemplate(payload: {
  name: string;
  description?: string;
  prompt?: string;
  isDefault?: boolean;
}) {
  const { data } = await api.post<TemplateItem>('/templates', payload);
  return data;
}

export async function deleteTemplate(templateId: string) {
  await api.delete(`/templates/${templateId}`);
}

export async function completeTask(taskId: string) {
  const { data } = await api.post<TaskDetail>(`/tasks/${taskId}/complete`);
  return data;
}

export async function createExport(taskId: string) {
  const { data } = await api.post<{ exportId: string; resourceId: string }>(`/tasks/${taskId}/exports`);
  return data;
}

export async function listResources(taskId: string) {
  const { data } = await api.get<ResourceItem[]>(`/tasks/${taskId}/resources`);
  return data;
}

export async function downloadResource(resourceId: string, filename: string) {
  const response = await api.get(`/resources/${resourceId}/download`, {
    responseType: 'blob',
    timeout: 120_000,
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchResourceBlob(resourceId: string) {
  const response = await api.get(`/resources/${resourceId}/download`, {
    responseType: 'blob',
    timeout: 60_000,
  });
  return response.data as Blob;
}
