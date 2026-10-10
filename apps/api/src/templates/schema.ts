export const DEFAULT_TEMPLATE_SCHEMA = {
  fields: [
    { key: 'productName', label: '商品名称', type: 'string' },
    { key: 'price', label: '单价', type: 'decimal' },
    { key: 'quantity', label: '数量', type: 'decimal' },
    { key: 'unit', label: '单位', type: 'string' },
  ],
} as const;
