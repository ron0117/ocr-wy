<template>
  <el-container class="layout">
    <el-aside :width="narrow ? '100%' : '232px'">
      <BrandMark />
      <div v-if="narrow" class="menu-label">俱乐部管理</div>
      <el-menu
        :default-active="active"
        :default-openeds="openedMenus"
        :ellipsis="false"
        :mode="narrow ? 'horizontal' : 'vertical'"
        router
      >
        <el-sub-menu v-if="!narrow" index="clubs-menu">
          <template #title>
            <el-icon><OfficeBuilding /></el-icon>
            <span>俱乐部管理</span>
          </template>
          <el-menu-item index="/clubs">创建俱乐部</el-menu-item>
          <el-menu-item index="/imports">导入人员</el-menu-item>
          <el-menu-item index="/members">人员列表</el-menu-item>
        </el-sub-menu>
        <template v-else>
          <el-menu-item index="/clubs">创建俱乐部</el-menu-item>
          <el-menu-item index="/imports">导入人员</el-menu-item>
          <el-menu-item index="/members">人员列表</el-menu-item>
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
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { OfficeBuilding } from '@element-plus/icons-vue';
import { me } from '../api/client';
import { useAuth } from '../composables/auth';
import BrandMark from './BrandMark.vue';

const auth = useAuth();
const router = useRouter();
const route = useRoute();
const narrow = ref(window.matchMedia('(max-width: 800px)').matches);
const active = computed(() => route.path);
const openedMenus = ['clubs-menu'];

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
