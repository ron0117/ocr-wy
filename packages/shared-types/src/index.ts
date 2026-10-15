export type TaskStatus =
  | 'UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_COMPLETED'
  | 'AI_PROCESSING'
  | 'REVIEW_REQUIRED'
  | 'COMPLETED'
  | 'FAILED';

export type ResourceType =
  | 'SOURCE_IMAGE'
  | 'OCR_JSON'
  | 'STRUCTURED_JSON'
  | 'EXCEL';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  UPLOADED: '待识别',
  OCR_PROCESSING: '识别中',
  OCR_COMPLETED: '识别完成',
  AI_PROCESSING: '整理中',
  REVIEW_REQUIRED: '待确认',
  COMPLETED: '已完成',
  FAILED: '失败',
};

export interface ProductRow {
  id: string;
  rowIndex: number;
  productName: string;
  price: string | null;
  quantity: string | null;
  total: string | null;
  unit: string | null;
  confidence: number | null;
  rawText: string | null;
  warnings: string[];
}

export interface OcrLine {
  text: string;
  confidence: number;
  box: number[][];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  roleId: string | null;
  isSuper: boolean;
  menuKeys: string[];
}

export interface PermissionMenuChild {
  key: string;
  title: string;
  path: string;
}

export interface PermissionMenu {
  key: string;
  title: string;
  children: PermissionMenuChild[];
}

export const MENU_CATALOG = [
  {
    key: 'club-management',
    title: '俱乐部管理',
    children: [
      { key: 'clubs', title: '创建俱乐部', path: '/clubs' },
      { key: 'imports', title: '导入人员', path: '/imports' },
      { key: 'members', title: '人员列表', path: '/members' },
    ],
  },
  {
    key: 'activity-management',
    title: '活动管理',
    children: [{ key: 'activities', title: '活动签到', path: '/activities' }],
  },
  {
    key: 'recruitment',
    title: '招聘管理',
    children: [{ key: 'applications', title: '申请列表', path: '/applications' }],
  },
  {
    key: 'system',
    title: '系统管理',
    children: [
      { key: 'accounts', title: '账号管理', path: '/accounts' },
      { key: 'roles', title: '角色管理', path: '/roles' },
    ],
  },
] as const;

export type MenuKey = (typeof MENU_CATALOG)[number]['children'][number]['key'];

export const MENU_KEYS: MenuKey[] = MENU_CATALOG.flatMap((group) => group.children.map((item) => item.key));

const MENU_KEY_SET = new Set<string>(MENU_KEYS);

export function isMenuKey(value: string): value is MenuKey {
  return MENU_KEY_SET.has(value);
}

export function menusForKeys(keys: readonly string[]): PermissionMenu[] {
  const allowed = new Set(keys);
  return MENU_CATALOG.map((group) => ({
    key: group.key,
    title: group.title,
    children: group.children
      .filter((item) => allowed.has(item.key))
      .map((item) => ({ key: item.key, title: item.title, path: item.path })),
  })).filter((group) => group.children.length > 0);
}
