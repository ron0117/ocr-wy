<template>
    <div class="page-head">
      <div>
        <h1>导入人员</h1>
        <p>先选择俱乐部，再上传一张或多张成员列表截图。AI 会筛掉杂讯，并合并重复人员。</p>
      </div>
    </div>
    <el-card shadow="never" style="max-width: 640px">
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
        :disabled="!clubId || uploading"
        :on-exceed="onExceed"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖入一张或多张截图，或点击选择</div>
        <template #tip>
          <div class="el-upload__tip">支持 PNG、JPEG、WebP，一次最多 20 张，单张不超过 10MB。未选择俱乐部时不能上传。</div>
        </template>
      </el-upload>
      <el-button type="primary" style="margin-top: 16px" :disabled="!clubId || fileList.length === 0" :loading="uploading" @click="submit">
        开始导入
      </el-button>
    </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadUserFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { errorMessage, importMembers, listClubs, type ClubItem } from '../api/client';

const clubs = ref<ClubItem[]>([]);
const clubId = ref<string>();
const fileList = ref<UploadUserFile[]>([]);
const loading = ref(true);
const uploading = ref(false);

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

async function submit() {
  if (!clubId.value) {
    ElMessage.error('请先选择俱乐部');
    return;
  }
  const files = fileList.value.flatMap((item) => (item.raw instanceof File ? [item.raw] : []));
  if (files.length === 0) {
    ElMessage.error('请上传图片文件');
    return;
  }
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  if (oversized) {
    ElMessage.error(`${oversized.name} 不能超过 10MB`);
    return;
  }
  uploading.value = true;
  try {
    const result = await importMembers(clubId.value, files);
    fileList.value = [];
    ElMessage.success(`已导入 ${result.imageCount} 张图片，写入 ${result.rowCount} 条人员`);
  } catch (cause) {
    ElMessage.error(errorMessage(cause, '导入失败'));
  } finally {
    uploading.value = false;
  }
}
</script>
