import { reactive } from 'vue';
import type { AuthUser } from '@ocr/shared-types';

const state = reactive({
  token: localStorage.getItem('ocr_token') ?? '',
  user: null as AuthUser | null,
});

export function useAuth() {
  function setSession(token: string, user: AuthUser) {
    state.token = token;
    state.user = user;
    localStorage.setItem('ocr_token', token);
  }

  function clear() {
    state.token = '';
    state.user = null;
    localStorage.removeItem('ocr_token');
  }

  return { state, setSession, clear };
}
