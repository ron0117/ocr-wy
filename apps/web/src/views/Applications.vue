<template>
  <div class="page-head">
    <div>
      <h1>申请列表</h1>
      <p>打开详情后变为已读。同意或不同意只记录这条申请的状态。</p>
    </div>
  </div>
  <el-card shadow="never">
    <el-radio-group v-model="read" style="margin-bottom: 16px" @change="load">
      <el-radio-button value="unread">未读</el-radio-button>
      <el-radio-button value="read">已读</el-radio-button>
    </el-radio-group>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
    <el-table v-loading="loading" :data="rows" empty-text="没有申请" row-key="id">
      <el-table-column prop="gameName" label="玩家名称" min-width="120" />
      <el-table-column prop="score" label="非凡评分" width="110" />
      <el-table-column prop="uid" label="uid" min-width="120" />
      <el-table-column prop="clubName" label="工会名称" min-width="120" />
      <el-table-column label="提交时间" width="140">
        <template #default="{ row }">{{ formatTime((row as ApplicationItem).createdAt) }}</template>
      </el-table-column>
      <el-table-column label="已读状态" width="100">
        <template #default="{ row }">{{ (row as ApplicationItem).read ? '已读' : '未读' }}</template>
      </el-table-column>
      <el-table-column label="处理状态" width="100">
        <template #default="{ row }">{{ decisionLabel((row as ApplicationItem).decision) }}</template>
      </el-table-column>
      <el-table-column label="操作" :width="narrow ? 96 : 200" :fixed="narrow ? false : 'right'">
        <template #default="{ row }">
          <div class="cell-ops">
            <el-button link type="primary" @click="openDetail(row as ApplicationItem)">详情</el-button>
            <el-button link type="primary" @click="decide(row as ApplicationItem, 'APPROVED')">同意</el-button>
            <el-button link type="primary" @click="decide(row as ApplicationItem, 'REJECTED')">不同意</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="detailOpen" title="申请详情" width="520px">
    <el-alert v-if="detailError" :title="detailError" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
    <el-descriptions v-if="detail" :column="1" border>
      <el-descriptions-item label="游戏名称">{{ detail.gameName }}</el-descriptions-item>
      <el-descriptions-item label="非凡评分">{{ detail.score }}</el-descriptions-item>
      <el-descriptions-item label="uid">{{ detail.uid }}</el-descriptions-item>
      <el-descriptions-item label="希望加入的工会">{{ detail.clubName }}</el-descriptions-item>
      <el-descriptions-item label="你选择无忧的理由">{{ detail.reason }}</el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
      <el-descriptions-item label="已读状态">{{ detail.read ? '已读' : '未读' }}</el-descriptions-item>
      <el-descriptions-item label="处理状态">{{ decisionLabel(detail.decision) }}</el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button @click="detailOpen = false">关闭</el-button>
      <el-button type="primary" :loading="deciding" @click="decideDetail('APPROVED')">同意</el-button>
      <el-button type="primary" :loading="deciding" @click="decideDetail('REJECTED')">不同意</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useNarrow } from '../composables/viewport';
import { formatTime } from '../lib/format';
import {
  applicationDetail,
  decideApplication,
  errorMessage,
  listApplications,
  type ApplicationDetail,
  type ApplicationItem,
} from '../api/client';

const narrow = useNarrow();
const read = ref<'unread' | 'read'>('unread');
const rows = ref<ApplicationItem[]>([]);
const loading = ref(false);
const error = ref('');
const detailOpen = ref(false);
const detail = ref<ApplicationDetail>();
const detailError = ref('');
const deciding = ref(false);

function decisionLabel(decision: ApplicationItem['decision']) {
  if (decision === 'APPROVED') return '同意';
  if (decision === 'REJECTED') return '不同意';
  return '待处理';
}

async function load(next?: string | number | boolean) {
  const current = next === 'read' || next === 'unread' ? next : read.value;
  loading.value = true;
  error.value = '';
  try {
    rows.value = await listApplications(current);
  } catch (cause) {
    error.value = errorMessage(cause, '申请列表加载失败');
  } finally {
    loading.value = false;
  }
}

watch(detailOpen, (open, previous) => {
  if (!open && previous) void load();
});

async function openDetail(row: ApplicationItem) {
  detailError.value = '';
  detail.value = undefined;
  detailOpen.value = true;
  try {
    detail.value = await applicationDetail(row.id);
  } catch (cause) {
    detailError.value = errorMessage(cause, '申请详情加载失败');
  }
}

async function decide(row: ApplicationItem, decision: 'APPROVED' | 'REJECTED') {
  error.value = '';
  try {
    await decideApplication(row.id, decision);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '更新处理状态失败');
  }
}

async function decideDetail(decision: 'APPROVED' | 'REJECTED') {
  if (!detail.value) return;
  deciding.value = true;
  detailError.value = '';
  try {
    const updated = await decideApplication(detail.value.id, decision);
    detail.value = { ...detail.value, ...updated };
  } catch (cause) {
    detailError.value = errorMessage(cause, '更新处理状态失败');
  } finally {
    deciding.value = false;
  }
}

onMounted(load);
</script>
