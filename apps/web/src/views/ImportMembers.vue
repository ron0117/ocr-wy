<template>
  <div class="page-head">
    <div>
      <h1>导入人员</h1>
      <p>先选择俱乐部。可以上传成员列表截图，也可以按模版导入。确认后才写入。</p>
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
      class="import-upload"
      v-model:file-list="fileList"
      drag
      multiple
      :auto-upload="false"
      :limit="20"
      accept="image/*"
      :disabled="!clubId || recognizing"
      :on-exceed="onExceed"
      :on-change="onFileChange"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">点击选择本地图片，或把截图拖到这里</div>
      <template #tip>
        <div class="el-upload__tip">支持 PNG、JPEG、WebP，一次最多 20 张。选择后会自动压缩再上传，清晰度与识别所用画面一致。未选择俱乐部时不能上传。</div>
      </template>
    </el-upload>
    <div class="form-actions" style="margin-top: 16px">
      <el-button type="primary" :disabled="!clubId || fileList.length === 0 || compressing" :loading="recognizing" @click="recognize">
        开始识别
      </el-button>
      <el-button :disabled="!clubId || recognizing" :loading="readingTemplate" @click="openTemplate">模版导入</el-button>
      <el-button @click="downloadTemplate">下载模版</el-button>
    </div>
    <input ref="templateInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden @change="onTemplateFile" />
  </el-card>
  <el-card v-else shadow="never">
    <p style="margin-top: 0">俱乐部：{{ clubName }} · {{ fromTemplate ? '模版' : '截图' }}</p>
    <el-alert title="确认后，这个俱乐部的人员会换成本次名单。同名玩家就地更新，名单里没有的人会被移除。" type="info" show-icon :closable="false" style="margin-bottom: 12px" />
    <el-table :data="drafts" row-key="key" empty-text="没有人员">
      <el-table-column v-if="fromTemplate" label="排名" width="140">
        <template #default="{ row }">
          <el-input-number v-model="row.rank" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="0" style="width: 100%" />
        </template>
      </el-table-column>
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
      <el-table-column label="非凡评分" width="200">
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
      <el-table-column label="操作" :width="narrow ? 72 : 80" :fixed="narrow ? false : 'right'">
        <template #default="{ $index }">
          <el-button link type="danger" @click="drafts.splice($index, 1)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="form-actions" style="margin-top: 16px">
      <el-button :disabled="confirming" @click="cancelReview">取消</el-button>
      <el-button type="primary" :loading="confirming" @click="confirm()">确认导入</el-button>
    </div>
    <el-dialog v-model="renaming" title="确认改名" width="640px">
      <p>这些有活动记录的人这次名单里没有了。如果是改名，选对应的新名称；不选就会按离开处理，活动记录先留着。</p>
      <div v-for="row in renameRows" :key="row.memberId" class="rename-row">
        <span>{{ row.playerName }}（{{ row.attendanceCount }} 场）</span>
        <el-select v-model="row.target" clearable placeholder="不是改名" style="width: 220px">
          <el-option v-for="name in renameArriving" :key="name" :label="name" :value="name" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="renaming = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="confirmRenames">确认导入</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useNarrow } from '../composables/viewport';
import { ElMessage } from 'element-plus';
import type { UploadFile, UploadRawFile, UploadUserFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { confirmMembers, confirmTemplateMembers, errorMessage, listClubs, previewMembers, renamePrompt, type ClubItem, type ImportMemberRow, type TemplateMemberRow } from '../api/client';
import { compressForVision } from './compress-image';
import templateUrl from '../../docs/模版.xlsx?url';
import { parseMemberTemplate } from './parse-member-template';

interface DraftRow {
  key: number;
  playerName: string;
  rank: number | null;
  level: number | null;
  path: string;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string;
}

const narrow = useNarrow();
const clubs = ref<ClubItem[]>([]);
const clubId = ref<string>();
const fileList = ref<UploadUserFile[]>([]);
const drafts = ref<DraftRow[]>([]);
const loading = ref(true);
const compressing = ref(false);
const recognizing = ref(false);
const readingTemplate = ref(false);
const confirming = ref(false);
const reviewing = ref(false);
const fromTemplate = ref(false);
const templateInput = ref<HTMLInputElement>();
const renaming = ref(false);
const renameArriving = ref<string[]>([]);
const renameRows = ref<Array<{ memberId: string; playerName: string; attendanceCount: number; target: string }>>([]);
let draftKey = 0;
let compressJobs = 0;

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

function allowedImage(file: File) {
  const type = file.type.toLowerCase();
  if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg' || type === 'image/webp') return true;
  return !type && /\.(png|jpe?g|webp)$/i.test(file.name);
}

function onFileChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw;
  if (!(raw instanceof File)) return;
  if (!allowedImage(raw)) {
    void nextTick(() => {
      fileList.value = fileList.value.filter((item) => item.uid !== uploadFile.uid);
    });
    ElMessage.error('请选择 PNG、JPEG 或 WebP 图片');
    return;
  }
  compressJobs += 1;
  compressing.value = true;
  void compressForVision(raw)
    .then((compressed) => {
      const item = fileList.value.find((row) => row.uid === uploadFile.uid);
      if (!item) return;
      const next = compressed as UploadRawFile;
      next.uid = uploadFile.uid;
      item.raw = next;
      item.name = next.name;
      item.size = next.size;
    })
    .catch(() => {
      fileList.value = fileList.value.filter((item) => item.uid !== uploadFile.uid);
      ElMessage.error(`${raw.name} 无法读取`);
    })
    .finally(() => {
      compressJobs = Math.max(0, compressJobs - 1);
      compressing.value = compressJobs > 0;
    });
}

function selectedFiles() {
  const files = fileList.value.flatMap((item) => (item.raw instanceof File ? [item.raw] : []));
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  const invalid = files.find((file) => !allowedImage(file));
  return { files, oversized, invalid };
}

async function recognize() {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const { files, oversized, invalid } = selectedFiles();
  if (compressing.value) {
    ElMessage.error('图片还在压缩，请稍候');
    return;
  }
  if (files.length === 0) {
    ElMessage.error('请上传图片文件');
    return;
  }
  if (invalid) {
    ElMessage.error('请选择 PNG、JPEG 或 WebP 图片');
    return;
  }
  if (oversized) {
    ElMessage.error(`${oversized.name} 压缩后仍超过 10MB`);
    return;
  }
  recognizing.value = true;
  try {
    const result = await previewMembers(clubId.value, files);
    drafts.value = result.rows.map((row) => ({
      key: ++draftKey,
      playerName: row.playerName,
      rank: null,
      level: row.level,
      path: row.path ?? '',
      score: row.score,
      fashion: row.fashion,
      weeklyActivity: row.weeklyActivity,
      joinedText: row.joinedText ?? '',
    }));
    fromTemplate.value = false;
    reviewing.value = true;
  } catch (cause) {
    ElMessage.error(errorMessage(cause, '识别失败'));
  } finally {
    recognizing.value = false;
  }
}

function downloadTemplate() {
  const link = document.createElement('a');
  link.href = templateUrl;
  link.download = '模版.xlsx';
  link.click();
}

function openTemplate() {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const input = templateInput.value;
  if (!input) return;
  input.value = '';
  input.click();
}

async function onTemplateFile(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !clubId.value) return;
  readingTemplate.value = true;
  try {
    const rows = await parseMemberTemplate(file);
    drafts.value = rows.map((row) => ({ key: ++draftKey, ...row }));
    fromTemplate.value = true;
    reviewing.value = true;
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '模版无法读取');
  } finally {
    readingTemplate.value = false;
  }
}

function cancelReview() {
  drafts.value = [];
  fromTemplate.value = false;
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

function templatePayload(rows: ImportMemberRow[]): TemplateMemberRow[] | null {
  const payload: TemplateMemberRow[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const rank = drafts.value[index]?.rank;
    if (rank === null || !Number.isInteger(rank) || rank < 0) {
      ElMessage.error('排名必须是大于等于 0 的整数');
      return null;
    }
    payload.push({ ...rows[index], rank });
  }
  return payload;
}

async function confirm(renames?: Array<{ memberId: string; playerName: string }>) {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const rows = confirmPayload();
  if (!rows) return;
  if (fromTemplate.value) {
    const templateRows = templatePayload(rows);
    if (!templateRows) return;
    confirming.value = true;
    try {
      const result = await confirmTemplateMembers(clubId.value, templateRows);
      drafts.value = [];
      fromTemplate.value = false;
      reviewing.value = false;
      ElMessage.success(`已写入 ${result.rowCount} 条人员`);
    } catch (cause) {
      ElMessage.error(errorMessage(cause, '导入失败'));
    } finally {
      confirming.value = false;
    }
    return;
  }
  const { files, oversized, invalid } = selectedFiles();
  if (compressing.value) {
    ElMessage.error('图片还在压缩，请稍候');
    return;
  }
  if (files.length === 0) {
    ElMessage.error('请上传图片文件');
    return;
  }
  if (invalid) {
    ElMessage.error('请选择 PNG、JPEG 或 WebP 图片');
    return;
  }
  if (oversized) {
    ElMessage.error(`${oversized.name} 压缩后仍超过 10MB`);
    return;
  }
  confirming.value = true;
  try {
    const result = await confirmMembers(clubId.value, files, rows, renames);
    fileList.value = [];
    drafts.value = [];
    reviewing.value = false;
    renaming.value = false;
    ElMessage.success(`已导入 ${result.imageCount} 张图片，写入 ${result.rowCount} 条人员`);
  } catch (cause) {
    const prompt = renamePrompt(cause);
    if (prompt && !renames) {
      renameArriving.value = prompt.arriving;
      renameRows.value = prompt.missing.map((row) => ({ ...row, target: '' }));
      renaming.value = true;
      return;
    }
    ElMessage.error(errorMessage(cause, '导入失败'));
  } finally {
    confirming.value = false;
  }
}

function confirmRenames() {
  const chosen = renameRows.value.filter((row) => row.target);
  const names = chosen.map((row) => row.target);
  if (new Set(names).size !== names.length) {
    ElMessage.error('一个新名称只能对应一个旧名');
    return;
  }
  void confirm(chosen.map((row) => ({ memberId: row.memberId, playerName: row.target })));
}
</script>
