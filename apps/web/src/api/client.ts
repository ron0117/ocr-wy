import axios from 'axios';
import type { AuthUser, PermissionMenu, ProductRow, TaskStatus } from '@ocr/shared-types';

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

export interface RenamePrompt {
  missing: Array<{ memberId: string; playerName: string; attendanceCount: number }>;
  arriving: string[];
}

export function renamePrompt(error: unknown): RenamePrompt | null {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data as { code?: string; missing?: RenamePrompt['missing']; arriving?: string[] } | undefined;
  if (data?.code !== 'NEED_RENAME' || !Array.isArray(data.missing) || !Array.isArray(data.arriving)) return null;
  return { missing: data.missing, arriving: data.arriving };
}

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
  creatorEmail: string | null;
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

export interface ImportMemberRow {
  playerName: string;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
}

export async function previewMembers(clubId: string, files: File[]) {
  const body = new FormData();
  for (const file of files) body.append('files', file);
  const { data } = await api.post<{ rows: ImportMemberRow[] }>(`/clubs/${clubId}/imports/preview`, body, {
    timeout: 600_000,
  });
  return data;
}

export async function confirmMembers(
  clubId: string,
  files: File[],
  rows: ImportMemberRow[],
  renames?: Array<{ memberId: string; playerName: string }>,
) {
  const body = new FormData();
  for (const file of files) body.append('files', file);
  body.append('rows', JSON.stringify(rows));
  if (renames) body.append('renames', JSON.stringify(renames));
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

export async function deleteMembers(ids: string[]) {
  const { data } = await api.post<{ deleted: number }>('/members/batch-delete', { ids });
  return data;
}

export interface MemberActivities {
  attended: Array<ActivityBrief & { late: boolean }>;
  missed: ActivityBrief[];
}

export interface ActivityBrief {
  id: string;
  title: string;
  status: 'PUBLISHED' | 'ENDED';
  startsAt: string;
  clubs: Array<{ id: string; name: string }>;
}

export async function memberActivities(memberId: string) {
  const { data } = await api.get<MemberActivities>(`/members/${memberId}/activities`);
  return data;
}

export interface AudienceOption {
  id: string;
  name: string;
}

export interface WecomAudience {
  parties: AudienceOption[];
  tags: AudienceOption[];
  users: AudienceOption[];
}

export interface ActivityItem {
  id: string;
  title: string;
  note: string | null;
  status: 'PUBLISHED' | 'ENDED';
  startsAt: string;
  remindAt: string | null;
  publishedAt: string;
  endedAt: string | null;
  clubs: Array<{ id: string; name: string }>;
}

export interface ActivityInput {
  title: string;
  note: string | null;
  clubIds: string[];
  startsAt: string;
}

export interface AttendanceRow {
  id: string;
  playerName: string;
  clubName: string;
  attended: boolean;
  late: boolean;
}

export async function listActivities() {
  const { data } = await api.get<ActivityItem[]>('/activities');
  return data;
}

export async function createActivity(payload: ActivityInput) {
  const { data } = await api.post<ActivityItem>('/activities', payload);
  return data;
}

export async function updateActivity(activityId: string, payload: ActivityInput) {
  const { data } = await api.patch<ActivityItem>(`/activities/${activityId}`, payload);
  return data;
}

export async function deleteActivity(activityId: string) {
  await api.delete(`/activities/${activityId}`);
}

export async function endActivity(activityId: string) {
  const { data } = await api.post<ActivityItem>(`/activities/${activityId}/end`);
  return data;
}

export async function activityAttendance(activityId: string) {
  const { data } = await api.get<AttendanceRow[]>(`/activities/${activityId}/attendance`);
  return data;
}

export async function saveActivityAttendance(
  activityId: string,
  marks: Array<{ memberId: string; late: boolean }>,
) {
  const { data } = await api.put<AttendanceRow[]>(`/activities/${activityId}/attendance`, { marks });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
  return data;
}

export async function permission() {
  const { data } = await api.post<{ menus: PermissionMenu[] }>('/permission');
  return data;
}

export interface AccountItem {
  id: string;
  email: string;
  name: string | null;
  disabled: boolean;
  roleId: string | null;
  roleName: string | null;
}

export async function listAccounts(email?: string) {
  const { data } = await api.get<AccountItem[]>('/accounts', { params: email ? { email } : {} });
  return data;
}

export async function createAccount(body: { email: string; password: string; name?: string; roleId: string }) {
  const { data } = await api.post<AccountItem>('/accounts', body);
  return data;
}

export async function updateAccount(
  id: string,
  body: { name?: string; roleId?: string; disabled?: boolean; password?: string },
) {
  const { data } = await api.patch<AccountItem>(`/accounts/${id}`, body);
  return data;
}

export async function deleteAccount(id: string) {
  await api.delete(`/accounts/${id}`);
}

export interface RoleItem {
  id: string;
  name: string;
  isSuper: boolean;
  menuKeys: string[];
  clubIds: string[];
  menuCount: number;
  clubCount: number;
}

export async function listRoles() {
  const { data } = await api.get<RoleItem[]>('/roles');
  return data;
}

export async function createRole(body: { name: string; menuKeys: string[]; clubIds: string[] }) {
  const { data } = await api.post<RoleItem>('/roles', body);
  return data;
}

export async function updateRole(id: string, body: { name: string; menuKeys: string[]; clubIds: string[] }) {
  const { data } = await api.patch<RoleItem>(`/roles/${id}`, body);
  return data;
}

export async function deleteRole(id: string) {
  await api.delete(`/roles/${id}`);
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

export interface AssistantDownload {
  exportId: string;
  fileName: string;
  clubName: string;
  memberCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  download: AssistantDownload | null;
}

export interface AssistantSessionView {
  id: string;
  processing: boolean;
  messages: AssistantMessage[];
}

export async function currentAssistantSession() {
  const { data } = await api.get<{ session: AssistantSessionView | null }>('/assistant/session');
  return data.session;
}

export async function openAssistantSession() {
  const { data } = await api.post<{ id: string }>('/assistant/sessions');
  return data;
}

export async function sendAssistantMessage(sessionId: string, text: string, clientRequestId: string) {
  const { data } = await api.post<{
    sessionId: string;
    processing: boolean;
    basicMode: boolean;
    message: AssistantMessage;
  }>(`/assistant/sessions/${sessionId}/messages`, { text, clientRequestId }, { timeout: 180_000 });
  return data;
}

export interface PublicClub {
  id: string;
  name: string;
}

export interface ApplicationItem {
  id: string;
  gameName: string;
  score: number;
  uid: string;
  clubName: string;
  createdAt: string;
  read: boolean;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ApplicationDetail extends ApplicationItem {
  reason: string;
}

export async function listApplyClubs() {
  const { data } = await api.get<PublicClub[]>('/apply/clubs');
  return data;
}

export async function submitApplication(body: {
  gameName: string;
  score: number;
  uid: string;
  clubId: string;
  reason: string;
}) {
  const { data } = await api.post<{ ok: true }>('/apply', body);
  return data;
}

export async function listApplications(read: 'unread' | 'read') {
  const { data } = await api.get<ApplicationItem[]>('/applications', { params: { read } });
  return data;
}

export async function applicationDetail(id: string) {
  const { data } = await api.get<ApplicationDetail>(`/applications/${id}`);
  return data;
}

export async function decideApplication(id: string, decision: 'APPROVED' | 'REJECTED') {
  const { data } = await api.patch<ApplicationItem>(`/applications/${id}`, { decision });
  return data;
}

export async function downloadAssistantExport(exportId: string, filename: string) {
  const response = await api.get(`/assistant/exports/${exportId}`, {
    responseType: 'blob',
    timeout: 120_000,
  });
  const blob = response.data as Blob;
  if (blob.type.includes('json') || blob.type.includes('text')) {
    const parsed = JSON.parse(await blob.text()) as { message?: string };
    throw new Error(parsed.message || '文件不可用');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
