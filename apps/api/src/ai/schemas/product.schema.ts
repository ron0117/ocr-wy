import { z } from 'zod';

const decimalString = z.union([
  z.string().regex(/^\d+(?:\.\d+)?$/),
  z.null(),
]);

export const ProductRowSchema = z
  .object({
    productName: z.string().trim().min(1).max(300),
    price: decimalString,
    quantity: decimalString,
    unit: z.string().max(30).nullable().optional(),
    sourceText: z.string().max(2000),
    warnings: z.array(z.string().max(200)).max(20),
  })
  .strict();

export const ProductTableSchema = z
  .object({
    columns: z
      .array(z.enum(['productName', 'price', 'quantity', 'unit', 'total']))
      .min(1)
      .max(30),
    rows: z.array(ProductRowSchema).max(10000),
  })
  .strict();

export const OperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('extract_from_ocr') }).strict(),
  z
    .object({
      type: z.literal('sort'),
      field: z.enum(['productName', 'price', 'quantity', 'total']),
      direction: z.enum(['asc', 'desc']),
    })
    .strict(),
  z
    .object({
      type: z.literal('calculate'),
      field: z.literal('total'),
      expression: z.literal('price * quantity'),
    })
    .strict(),
  z
    .object({
      type: z.literal('flag_missing'),
      field: z.enum(['price', 'quantity', 'productName']),
    })
    .strict(),
]);

export const ChatPlanSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    operations: z.array(OperationSchema).max(10),
  })
  .strict();

export type ProductTable = z.infer<typeof ProductTableSchema>;
export type ChatPlan = z.infer<typeof ChatPlanSchema>;
export type ChatOperation = z.infer<typeof OperationSchema>;

export const PRODUCT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    columns: {
      type: 'array',
      items: { type: 'string', enum: ['productName', 'price', 'quantity', 'unit', 'total'] },
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productName: { type: 'string' },
          price: { type: ['string', 'null'] },
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          sourceText: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
        required: ['productName', 'price', 'quantity', 'unit', 'sourceText', 'warnings'],
      },
    },
  },
  required: ['columns', 'rows'],
} as const;

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    operations: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: { type: { const: 'extract_from_ocr' } },
            required: ['type'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { const: 'sort' },
              field: { enum: ['productName', 'price', 'quantity', 'total'] },
              direction: { enum: ['asc', 'desc'] },
            },
            required: ['type', 'field', 'direction'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { const: 'calculate' },
              field: { const: 'total' },
              expression: { const: 'price * quantity' },
            },
            required: ['type', 'field', 'expression'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { const: 'flag_missing' },
              field: { enum: ['price', 'quantity', 'productName'] },
            },
            required: ['type', 'field'],
          },
        ],
      },
    },
  },
  required: ['message', 'operations'],
} as const;
