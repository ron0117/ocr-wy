import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './components/AppShell.vue';
import { firstMenuPath, useAuth } from './composables/auth';
import ActivityDetailView from './views/ActivityDetail.vue';
import ActivitiesView from './views/Activities.vue';
import AccountsView from './views/Accounts.vue';
import ClubsView from './views/Clubs.vue';
import ImportMembersView from './views/ImportMembers.vue';
import LoginView from './views/Login.vue';
import MembersView from './views/Members.vue';
import NoMenuView from './views/NoMenu.vue';
import PlayerActivityView from './views/PlayerActivity.vue';
import RolesView from './views/Roles.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/register', redirect: '/login' },
    { path: '/a/:id', component: PlayerActivityView, meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', component: NoMenuView },
        { path: 'clubs', component: ClubsView, meta: { menu: 'clubs' } },
        { path: 'imports', component: ImportMembersView, meta: { menu: 'imports' } },
        { path: 'members', component: MembersView, meta: { menu: 'members' } },
        { path: 'activities', component: ActivitiesView, meta: { menu: 'activities' } },
        { path: 'activities/:id', component: ActivityDetailView, meta: { menu: 'activities' } },
        { path: 'accounts', component: AccountsView, meta: { menu: 'accounts' } },
        { path: 'roles', component: RolesView, meta: { menu: 'roles' } },
      ],
    },
    { path: '/tasks', redirect: '/' },
    { path: '/tasks/new', redirect: '/' },
    { path: '/tasks/:id', redirect: '/' },
    { path: '/templates', redirect: '/' },
  ],
});

const auth = useAuth();

router.beforeEach(async (to) => {
  const token = localStorage.getItem('ocr_token');
  if (to.meta.public) {
    if (token && to.path === '/login') {
      try {
        await auth.ensureMenus();
      } catch {
        auth.clear();
        return true;
      }
      return firstMenuPath(auth.state.menus) ?? '/';
    }
    return true;
  }
  if (!token) return '/login';
  try {
    await auth.ensureMenus();
  } catch {
    auth.clear();
    return '/login';
  }
  const required = [...to.matched].reverse().map((record) => record.meta.menu).find(Boolean);
  const allowed = new Set((auth.state.menus ?? []).flatMap((group) => group.children.map((item) => item.key)));
  if (typeof required === 'string') {
    if (allowed.has(required)) return true;
    return firstMenuPath(auth.state.menus) ?? '/';
  }
  const next = firstMenuPath(auth.state.menus);
  if (next && to.path !== next) return next;
  return true;
});
