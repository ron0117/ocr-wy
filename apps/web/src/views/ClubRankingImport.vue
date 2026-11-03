<template>
  <div class="page-head">
    <div>
      <h1>俱乐部数据采集</h1>
      <p>选择排行 JSON，只上传其中的 clubs。</p>
    </div>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-upload :auto-upload="false" :show-file-list="false" accept=".json,application/json" :on-change="onFile">
      <el-button>选择 JSON</el-button>
    </el-upload>
    <p v-if="fileName" class="file-name">{{ fileName }}</p>
    <p v-if="previewCount !== null">将上传 {{ previewCount }} 条</p>
    <el-button type="primary" :disabled="pending === null" :loading="uploading" @click="submit">上传</el-button>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { UploadFile } from 'element-plus';
import { ElMessage } from 'element-plus';
import { normalizeClubRankingClubs, type ClubRankingRow } from '@ocr/guide-types';
import { errorMessage, uploadClubRankings } from '../api/client';

const error = ref('');
const fileName = ref('');
const previewCount = ref<number | null>(null);
const pending = ref<ClubRankingRow[] | null>(null);
const uploading = ref(false);

function resetPending() {
  previewCount.value = null;
  pending.value = null;
}

async function onFile(upload: UploadFile) {
  error.value = '';
  resetPending();
  const file = upload.raw;
  if (!file) {
    error.value = '请选择 .json 文件';
    return;
  }
  fileName.value = file.name;
  if (!file.name.toLowerCase().endsWith('.json')) {
    error.value = '请选择 .json 文件';
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    error.value = 'JSON 无法解析';
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    error.value = 'JSON 根必须是对象';
    return;
  }
  const result = normalizeClubRankingClubs((parsed as { clubs?: unknown }).clubs);
  if (!result.ok) {
    error.value = result.message;
    return;
  }
  pending.value = result.clubs;
  previewCount.value = result.clubs.length;
}

async function submit() {
  if (!pending.value) return;
  uploading.value = true;
  error.value = '';
  try {
    const { count } = await uploadClubRankings(pending.value);
    ElMessage.success(`已写入 ${count} 条`);
  } catch (cause) {
    error.value = errorMessage(cause, '上传失败');
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.file-name {
  margin: 12px 0 0;
  color: var(--el-text-color-secondary);
}

.el-card p {
  margin: 12px 0;
}

.el-card .el-button {
  margin-top: 4px;
}
</style>
