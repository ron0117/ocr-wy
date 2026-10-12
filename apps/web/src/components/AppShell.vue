<template>
  <el-container class="layout">
    <el-aside :width="narrow ? '100%' : '232px'">
      <BrandMark />
      <div v-if="narrow && menus.length" class="menu-label">{{ menus[0].title }}</div>
      <el-menu
        :key="menuStamp"
        :default-active="active"
        :default-openeds="openedMenus"
        :ellipsis="false"
        :mode="narrow ? 'horizontal' : 'vertical'"
        router
      >
        <template v-if="!narrow">
          <el-sub-menu v-for="group in menus" :key="group.key" :index="group.key">
            <template #title>
              <el-icon><OfficeBuilding v-if="group.key !== 'system'" /><Setting v-else /></el-icon>
              <span>{{ group.title }}</span>
            </template>
            <el-menu-item v-for="item in group.children" :key="item.key" :index="item.path">
              {{ item.title }}
            </el-menu-item>
          </el-sub-menu>
        </template>
        <template v-else>
          <el-menu-item v-for="item in flatMenus" :key="item.key" :index="item.path">
            {{ item.title }}
          </el-menu-item>
        </template>
      </el-menu>
      <div class="aside-user">
        <div>{{ auth.state.user?.email }}</div>
        <el-button link type="primary" @click="logout">退出</el-button>
      </div>
    </el-aside>
    <el-main>
      <RouterView />
    </el-main>
    <XiaoyouPanel />
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { OfficeBuilding, Setting } from '@element-plus/icons-vue';
import { me } from '../api/client';
import { useAuth } from '../composables/auth';
import BrandMark from './BrandMark.vue';
import XiaoyouPanel from './XiaoyouPanel.vue';

const auth = useAuth();
const router = useRouter();
const route = useRoute();
const narrow = ref(window.matchMedia('(max-width: 800px)').matches);
const active = computed(() => (route.path.startsWith('/activities') ? '/activities' : route.path));
const menus = computed(() => auth.state.menus ?? []);
const flatMenus = computed(() => menus.value.flatMap((group) => group.children));
const openedMenus = computed(() => menus.value.map((group) => group.key));
const menuStamp = computed(() => menus.value.map((group) => group.key).join(','));

let media: MediaQueryList | null = null;

function onMedia() {
  narrow.value = media?.matches ?? false;
}

onMounted(async () => {
  media = window.matchMedia('(max-width: 800px)');
  media.addEventListener('change', onMedia);
  if (!auth.state.token || auth.state.user) return;
  try {
    auth.state.user = await me();
  } catch {
    auth.clear();
    await router.push('/login');
  }
});

onUnmounted(() => media?.removeEventListener('change', onMedia));

function logout() {
  auth.clear();
  void router.push('/login');
}
</script>
