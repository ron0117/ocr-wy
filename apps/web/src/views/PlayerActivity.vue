<template>
  <main class="player-page">
    <h1>{{ view?.title || '活动签到' }}</h1>
    <p v-if="view" class="muted">{{ view.clubs.map((club) => club.name).join('、') }}</p>
    <p v-if="view" class="muted">开始时间：{{ formatTime(view.startsAt) }}</p>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin: 16px 0" />
    <template v-if="view?.phase === 'unbound'">
      <el-select v-model="memberId" placeholder="选择你的角色" style="width: 100%">
        <el-option
          v-for="item in view.candidates || []"
          :key="item.id"
          :label="`${item.clubName} · ${item.playerName}`"
          :value="item.id"
        />
      </el-select>
      <el-button type="primary" :loading="saving" style="width: 100%; margin-top: 16px" @click="bind">确认绑定</el-button>
    </template>
    <template v-else-if="view?.phase === 'ready'">
      <p>当前角色：{{ view.member?.clubName }} · {{ view.member?.playerName }}</p>
      <p v-if="checkedAt">已于 {{ formatTime(checkedAt) }} 签到</p>
      <el-button v-else type="primary" :loading="saving" style="width: 100%" @click="checkIn">签到</el-button>
    </template>
    <template v-else-if="view?.phase === 'other_club'">
      <p>你已绑定「{{ view.member?.clubName }}」的「{{ view.member?.playerName }}」，不能签到这场，也不能改绑。</p>
    </template>
    <template v-else-if="view?.phase === 'closed'">
      <p>活动已结束。</p>
      <p v-if="view.member">角色：{{ view.member.clubName }} · {{ view.member.playerName }}</p>
      <p v-if="checkedAt">已于 {{ formatTime(checkedAt) }} 签到</p>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { bindPlayerRole, errorMessage, playerActivity, playerCheckIn, type PlayerActivity } from '../api/client';

const route = useRoute();
const view = ref<PlayerActivity>();
const memberId = ref('');
const checkedAt = ref<string | null>(null);
const error = ref('');
const saving = ref(false);

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function captureToken() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = hash.get('token');
  if (!token) return;
  sessionStorage.setItem('wecom_token', token);
  history.replaceState(null, '', location.pathname + location.search);
}

async function load() {
  error.value = '';
  const id = String(route.params.id);
  try {
    view.value = await playerActivity(id);
    checkedAt.value = view.value.checkedAt ?? null;
    memberId.value = '';
  } catch (cause) {
    error.value = errorMessage(cause, '活动加载失败');
  }
}

async function bind() {
  if (!memberId.value) {
    error.value = '请选择角色';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await bindPlayerRole(String(route.params.id), memberId.value);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '绑定失败');
    await load();
  } finally {
    saving.value = false;
  }
}

async function checkIn() {
  saving.value = true;
  error.value = '';
  try {
    const result = await playerCheckIn(String(route.params.id));
    checkedAt.value = result.checkedAt;
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '签到失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  captureToken();
  const params = new URLSearchParams(location.search);
  const inWecom = /wxwork/i.test(navigator.userAgent);
  const token = sessionStorage.getItem('wecom_token');
  if (!inWecom && !token) {
    error.value = '请在企业微信中打开';
    return;
  }
  if (params.get('error') && !token) {
    error.value = '无法识别身份';
    return;
  }
  if (!token) {
    location.assign(`/api/v1/wecom/oauth/start?activityId=${route.params.id}`);
    return;
  }
  await load();
});
</script>

<style scoped>
.player-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}
.player-page h1 {
  margin: 0 0 8px;
  font-size: 22px;
}
.muted {
  margin: 0 0 6px;
  color: #6d8eab;
}
</style>
