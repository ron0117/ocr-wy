import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './components/AppShell.vue';
import { ALWAYS_VISIBLE_MENU_KEYS } from '@ocr/shared-types';
import { firstMenuPath, useAuth } from './composables/auth';
import ApplicationsView from './views/Applications.vue';
import ApplyView from './views/Apply.vue';
import ActivitiesView from './views/Activities.vue';
import ActivityRegistrationsView from './views/ActivityRegistrations.vue';
import ActivitySignupView from './views/ActivitySignup.vue';
import AccountsView from './views/Accounts.vue';
import ClubsView from './views/Clubs.vue';
import ImportMembersView from './views/ImportMembers.vue';
import HomeView from './views/Home.vue';
import LoginView from './views/Login.vue';
import MembersView from './views/Members.vue';
import RolesView from './views/Roles.vue';
import WikiAdminView from './views/WikiAdmin.vue';
import ClubRankingImportView from './views/ClubRankingImport.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/apply', component: ApplyView, meta: { public: true } },
    { path: '/a/:activityId', component: ActivitySignupView, meta: { public: true } },
    { path: '/register', redirect: '/login' },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', component: HomeView },
        { path: 'clubs', component: ClubsView, meta: { menu: 'clubs' } },
        { path: 'imports', component: ImportMembersView, meta: { menu: 'imports' } },
        { path: 'members', component: MembersView, meta: { menu: 'members' } },
        { path: 'activities', component: ActivitiesView, meta: { menu: 'activities' } },
        { path: 'activity-registrations', component: ActivityRegistrationsView, meta: { menu: 'activity-registrations' } },
        { path: 'applications', component: ApplicationsView, meta: { menu: 'applications' } },
        { path: 'accounts', component: AccountsView, meta: { menu: 'accounts' } },
        { path: 'roles', component: RolesView, meta: { menu: 'roles' } },
        { path: 'wiki-admin', component: WikiAdminView, meta: { menu: 'wiki-admin' } },
        { path: 'club-ranking-import', component: ClubRankingImportView, meta: { menu: 'club-ranking-import' } },
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
      return '/';
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
    if (allowed.has(required) || (ALWAYS_VISIBLE_MENU_KEYS as readonly string[]).includes(required)) return true;
    return firstMenuPath(auth.state.menus) ?? '/';
  }
  if (to.path === '/') return true;
  const next = firstMenuPath(auth.state.menus);
  if (next && to.path !== next) return next;
  return true;
});
