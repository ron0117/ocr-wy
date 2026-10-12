const OBJECT_NAME =
  /^(?:ocr\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(source\/[0-9a-f-]{36}\.(png|jpg|webp)|ocr\/[0-9a-f-]{36}\.json|structured\/[0-9a-f-]{36}\.json|exports\/[0-9a-f-]{36}\.xlsx)|imports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)|assistant\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.xlsx)$/i;

export function assertObjectName(objectName: string): string {
  if (!OBJECT_NAME.test(objectName) || objectName.includes('..')) {
    throw new Error('非法对象路径');
  }
  return objectName;
}
