import { MENU_KEYS, type AuthUser } from '@ocr/shared-types';

export function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  roleId: string | null;
  role: { isSuper: boolean; menus: { menuKey: string }[] } | null;
}): AuthUser {
  const isSuper = Boolean(user.role?.isSuper);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    isSuper,
    menuKeys: isSuper ? [...MENU_KEYS] : (user.role?.menus.map((item) => item.menuKey) ?? []),
  };
}
