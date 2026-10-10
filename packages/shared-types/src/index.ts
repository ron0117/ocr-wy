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
}
