<template>
  <div class="page-head">
    <div>
      <h1>导入人员</h1>
      <p>先选择俱乐部，再上传一张或多张成员列表截图。AI 直接读图，确认后才写入。</p>
    </div>
  </div>
  <el-card v-if="!reviewing" shadow="never" style="max-width: 640px">
    <el-form label-position="top">
      <el-form-item label="俱乐部" required>
        <el-select v-model="clubId" placeholder="请选择俱乐部" style="width: 100%" :loading="loading">
          <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <el-upload
      v-model:file-list="fileList"
      drag
      multiple
      :auto-upload="false"
      :limit="20"
      accept="image/png,image/jpeg,image/webp"
      :disabled="!clubId || recognizing"
      :on-exceed="onExceed"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖入一张或多张截图，或点击选择</div>
      <template #tip>
        <div class="el-upload__tip">支持 PNG、JPEG、WebP，一次最多 20 张，单张不超过 10MB。未选择俱乐部时不能上传。</div>
      </template>
    </el-upload>
    <el-button type="primary" style="margin-top: 16px" :disabled="!clubId || fileList.length === 0" :loading="recognizing" @click="recognize">
      开始识别
    </el-button>
  </el-card>
  <el-card v-else shadow="never">
    <p style="margin-top: 0">俱乐部：{{ clubName }}</p>
    <el-alert title="留空的格子在确认后会清空该玩家库里的旧值。" type="info" show-icon :closable="false" style="margin-bottom: 12px" />
    <el-table :data="drafts" row-key="key" empty-text="没有人员">
      <el-table-column label="玩家名称" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.playerName" maxlength="40" />
        </template>
      </el-table-column>
      <el-table-column label="等级" width="140">
        <template #default="{ row }">
          <el-input-number v-model="row.level" :min="1" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="途径" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.path" maxlength="40" />
        </template>
      </el-table-column>
      <el-table-column label="非凡评分" width="150">
        <template #default="{ row }">
          <el-input-number v-model="row.score" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="风尚度" width="150">
        <template #default="{ row }">
          <el-input-number v-model="row.fashion" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="周活跃" width="150">
        <template #default="{ row }">
          <el-input-number v-model="row.weeklyActivity" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="入会时间" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.joinedText" maxlength="40" placeholder="如 26天" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ $index }">
          <el-button link type="danger" @click="drafts.splice($index, 1)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div style="margin-top: 16px">
      <el-button :disabled="confirming" @click="cancelReview">取消</el-button>
      <el-button type="primary" :loading="confirming" @click="confirm">确认导入</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadUserFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { confirmMembers, errorMessage, listClubs, previewMembers, type ClubItem, type ImportMemberRow } from '../api/client';

interface DraftRow {
  key: number;
  playerName: string;
  level: number | null;
  path: string;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string;
}

const clubs = ref<ClubItem[]>([]);
const clubId = ref<string>();
const fileList = ref<UploadUserFile[]>([]);
const drafts = ref<DraftRow[]>([]);
const loading = ref(true);
const recognizing = ref(false);
const confirming = ref(false);
const reviewing = ref(false);
let draftKey = 0;

const clubName = computed(() => clubs.value.find((club) => club.id === clubId.value)?.name ?? '');

onMounted(async () => {
  try {
    clubs.value = await listClubs();
  } catch (cause) {
    ElMessage.error(errorMessage(cause, '俱乐部加载失败'));
  } finally {
    loading.value = false;
  }
});

function onExceed() {
  ElMessage.error('一次最多上传 20 张图片');
}

function selectedFiles() {
  const files = fileList.value.flatMap((item) => (item.raw instanceof File ? [item.raw] : []));
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  return { files, oversized };
}

async function recognize() {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const { files, oversized } = selectedFiles();
  if (files.length === 0) {
    ElMessage.error('请上传图片文件');
    return;
  }
  if (oversized) {
    ElMessage.error(`${oversized.name} 不能超过 10MB`);
    return;
  }
  recognizing.value = true;
  try {
    const result = await previewMembers(clubId.value, files);
    drafts.value = result.rows.map((row) => ({
      key: ++draftKey,
      playerName: row.playerName,
      level: row.level,
      path: row.path ?? '',
      score: row.score,
      fashion: row.fashion,
      weeklyActivity: row.weeklyActivity,
      joinedText: row.joinedText ?? '',
    }));
    reviewing.value = true;
  } catch (cause) {
    ElMessage.error(errorMessage(cause, '识别失败'));
  } finally {
    recognizing.value = false;
  }
}

function cancelReview() {
  drafts.value = [];
  reviewing.value = false;
}

function confirmPayload(): ImportMemberRow[] | null {
  if (drafts.value.length === 0) {
    ElMessage.error('请至少保留一名玩家');
    return null;
  }
  const seen = new Set<string>();
  const rows: ImportMemberRow[] = [];
  for (const row of drafts.value) {
    const playerName = row.playerName.trim();
    if (!playerName) {
      ElMessage.error('请填写玩家名称');
      return null;
    }
    const key = playerName.toLowerCase();
    if (seen.has(key)) {
      ElMessage.error('玩家名称重复');
      return null;
    }
    seen.add(key);
    rows.push({
      playerName,
      level: row.level,
      path: row.path.trim() || null,
      score: row.score,
      fashion: row.fashion,
      weeklyActivity: row.weeklyActivity,
      joinedText: row.joinedText.trim() || null,
    });
  }
  return rows;
}

async function confirm() {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const rows = confirmPayload();
  if (!rows) return;
  const { files, oversized } = selectedFiles();
  if (files.length === 0) {
    ElMessage.error('请上传图片文件');
    return;
  }
  if (oversized) {
    ElMessage.error(`${oversized.name} 不能超过 10MB`);
    return;
  }
  confirming.value = true;
  try {
    const result = await confirmMembers(clubId.value, files, rows);
    fileList.value = [];
    drafts.value = [];
    reviewing.value = false;
    ElMessage.success(`已导入 ${result.imageCount} 张图片，写入 ${result.rowCount} 条人员`);
  } catch (cause) {
    ElMessage.error(errorMessage(cause, '导入失败'));
  } finally {
    confirming.value = false;
  }
}
</script>
