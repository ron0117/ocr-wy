import { reactive } from 'vue';
import type { AuthUser, PermissionMenu } from '@ocr/shared-types';
import { permission } from '../api/client';

const state = reactive({
  token: localStorage.getItem('ocr_token') ?? '',
  user: null as AuthUser | null,
  menus: null as PermissionMenu[] | null,
});

let loadingMenus: Promise<void> | null = null;

export function firstMenuPath(menus: PermissionMenu[] | null) {
  return menus?.[0]?.children[0]?.path ?? null;
}

export function useAuth() {
  function setSession(token: string, user: AuthUser) {
    state.token = token;
    state.user = user;
    state.menus = null;
    localStorage.setItem('ocr_token', token);
  }

  function clear() {
    state.token = '';
    state.user = null;
    state.menus = null;
    loadingMenus = null;
    localStorage.removeItem('ocr_token');
  }

  function ensureMenus() {
    if (!state.token || state.menus) return Promise.resolve();
    if (!loadingMenus) {
      loadingMenus = permission()
        .then((result) => {
          state.menus = result.menus;
        })
        .finally(() => {
          loadingMenus = null;
        });
    }
    return loadingMenus;
  }

  return { state, setSession, clear, ensureMenus };
}
