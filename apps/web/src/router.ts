import { createRouter, createWebHistory } from 'vue-router';
import LoginView from './views/Login.vue';
import RegisterView from './views/Register.vue';
import AppShell from './components/AppShell.vue';
import ClubsView from './views/Clubs.vue';
import ImportMembersView from './views/ImportMembers.vue';
import MembersView from './views/Members.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/register', component: RegisterView, meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', redirect: '/clubs' },
        { path: 'clubs', component: ClubsView },
        { path: 'imports', component: ImportMembersView },
        { path: 'members', component: MembersView },
      ],
    },
    { path: '/tasks', redirect: '/clubs' },
    { path: '/tasks/new', redirect: '/clubs' },
    { path: '/tasks/:id', redirect: '/clubs' },
    { path: '/templates', redirect: '/clubs' },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('ocr_token');
  if (to.meta.public) {
    if (token && (to.path === '/login' || to.path === '/register')) return '/clubs';
    return true;
  }
  if (!token) return '/login';
  return true;
});
