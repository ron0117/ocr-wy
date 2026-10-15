<template>
  <el-container class="layout" :class="{ 'is-narrow': narrow }">
    <header v-if="narrow" class="mobile-bar">
      <el-button class="menu-toggle" text aria-label="打开菜单" @click="drawer = true">
        <el-icon :size="22"><Menu /></el-icon>
      </el-button>
      <BrandMark />
      <el-button link type="primary" @click="logout">退出</el-button>
    </header>
    <el-aside v-else width="232px">
      <BrandMark />
      <el-menu
        :key="menuStamp"
        :default-active="active"
        :default-openeds="openedMenus"
        :ellipsis="false"
        router
      >
        <el-menu-item index="/">
          <el-icon><Calendar /></el-icon>
          <span>活动安排</span>
        </el-menu-item>
        <el-sub-menu v-for="group in menus" :key="group.key" :index="group.key">
          <template #title>
            <el-icon><OfficeBuilding v-if="group.key !== 'system'" /><Setting v-else /></el-icon>
            <span>{{ group.title }}</span>
          </template>
          <el-menu-item v-for="item in group.children" :key="item.key" :index="item.path">
            {{ item.title }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
      <div class="aside-user">
        <div class="aside-email">{{ auth.state.user?.email }}</div>
        <el-button link type="primary" @click="logout">退出</el-button>
      </div>
    </el-aside>
    <el-main>
      <RouterView />
    </el-main>
    <XiaoyouPanel />
  </el-container>
  <el-drawer
    v-model="drawer"
    direction="ltr"
    size="280px"
    :with-header="false"
    class="nav-drawer"
    body-class="nav-drawer-body"
  >
    <div class="drawer-nav">
      <BrandMark />
      <el-menu
        :key="menuStamp"
        :default-active="active"
        :default-openeds="openedMenus"
        :ellipsis="false"
        router
        @select="drawer = false"
      >
        <el-menu-item index="/">
          <el-icon><Calendar /></el-icon>
          <span>活动安排</span>
        </el-menu-item>
        <el-sub-menu v-for="group in menus" :key="group.key" :index="group.key">
          <template #title>
            <el-icon><OfficeBuilding v-if="group.key !== 'system'" /><Setting v-else /></el-icon>
            <span>{{ group.title }}</span>
          </template>
          <el-menu-item v-for="item in group.children" :key="item.key" :index="item.path">
            {{ item.title }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
      <div class="aside-user">
        <div class="aside-email">{{ auth.state.user?.email }}</div>
        <el-button link type="primary" @click="logout">退出</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Calendar, Menu, OfficeBuilding, Setting } from '@element-plus/icons-vue';
import { me } from '../api/client';
import { useAuth } from '../composables/auth';
import { useNarrow } from '../composables/viewport';
import BrandMark from './BrandMark.vue';
import XiaoyouPanel from './XiaoyouPanel.vue';

const auth = useAuth();
const router = useRouter();
const route = useRoute();
const narrow = useNarrow();
const drawer = ref(false);
const active = computed(() => (route.path.startsWith('/activities') ? '/activities' : route.path));
const menus = computed(() => auth.state.menus ?? []);
const openedMenus = computed(() => menus.value.map((group) => group.key));
const menuStamp = computed(() => menus.value.map((group) => group.key).join(','));

watch(() => route.fullPath, () => {
  drawer.value = false;
});

watch(narrow, (value) => {
  if (!value) drawer.value = false;
});

onMounted(async () => {
  if (!auth.state.token || auth.state.user) return;
  try {
    auth.state.user = await me();
  } catch {
    auth.clear();
    await router.push('/login');
  }
});

function logout() {
  auth.clear();
  void router.push('/login');
}
</script>
