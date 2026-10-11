<template>
  <div class="page-head">
    <div>
      <h1>{{ activity?.title || '签到情况' }}</h1>
      <p v-if="activity">{{ activity.clubs.map((club) => club.name).join('、') }} · {{ activity.status === 'PUBLISHED' ? '已发布' : '已结束' }}</p>
    </div>
    <el-button @click="router.push('/activities')">返回</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-table v-loading="loading" :data="rows" empty-text="这场活动没有人员">
      <el-table-column prop="playerName" label="玩家名称" min-width="120" />
      <el-table-column prop="clubName" label="所属俱乐部" min-width="120" />
      <el-table-column label="是否绑定通知" width="140">
        <template #default="{ row }">{{ row.notifyBound ? '已绑定' : '未绑定' }}</template>
      </el-table-column>
      <el-table-column label="是否已签到" width="120">
        <template #default="{ row }">{{ row.checkedIn ? '已签到' : '未签到' }}</template>
      </el-table-column>
      <el-table-column label="签到时间" min-width="170">
        <template #default="{ row }">{{ row.checkedAt ? formatTime(row.checkedAt) : '—' }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { activityCheckIns, errorMessage, getActivity, type ActivityItem, type CheckInRow } from '../api/client';

const route = useRoute();
const router = useRouter();
const activity = ref<ActivityItem>();
const rows = ref<CheckInRow[]>([]);
const loading = ref(false);
const error = ref('');

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  const id = String(route.params.id);
  loading.value = true;
  try {
    activity.value = await getActivity(id);
    rows.value = await activityCheckIns(id);
  } catch (cause) {
    error.value = errorMessage(cause, '签到情况加载失败');
  } finally {
    loading.value = false;
  }
});
</script>
