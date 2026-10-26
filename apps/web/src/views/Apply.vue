<template>
  <div class="public-page">
    <div class="public-form-wrap">
      <el-card shadow="hover">
        <template #header>
          <strong>无忧大家庭欢迎你的加入~</strong>
        </template>
        <el-form label-position="top" size="large" @submit.prevent="submit">
          <el-form-item label="玩家名称" required>
            <el-input v-model="gameName" maxlength="64" />
          </el-form-item>
          <el-form-item label="非凡评分" required>
            <el-input-number
              v-model="score"
              :min="0"
              :max="2147483647"
              :step="1"
              :precision="0"
              :value-on-clear="null"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="uid" required>
            <el-input v-model="uid" maxlength="64" />
          </el-form-item>
          <el-form-item label="希望加入的工会" required>
            <el-select v-model="clubId" placeholder="请选择工会" style="width: 100%" :loading="loadingClubs">
              <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="你选择无忧的理由" required>
            <el-input v-model="reason" type="textarea" maxlength="500" :rows="4" />
          </el-form-item>
          <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
          <el-alert v-if="success" :title="success" type="success" show-icon :closable="false" style="margin-bottom: 12px" />
          <el-button type="primary" native-type="submit" :loading="submitting" style="width: 100%">提交</el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { errorMessage, listApplyClubs, submitApplication, type PublicClub } from '../api/client';

const clubs = ref<PublicClub[]>([]);
const loadingClubs = ref(false);
const submitting = ref(false);
const gameName = ref('');
const score = ref<number | null>(null);
const uid = ref('');
const clubId = ref<string>();
const reason = ref('');
const error = ref('');
const success = ref('');

onMounted(async () => {
  loadingClubs.value = true;
  try {
    clubs.value = await listApplyClubs();
  } catch (cause) {
    error.value = errorMessage(cause, '工会列表加载失败');
  } finally {
    loadingClubs.value = false;
  }
});

function invalidMessage() {
  if (!gameName.value.trim()) return '请填写游戏名称';
  if (score.value === null || score.value === undefined) return '请填写非凡评分';
  if (!uid.value.trim()) return '请填写 uid';
  if (!clubId.value) return '请选择工会';
  if (!reason.value.trim()) return '请填写你选择无忧的理由';
  return '';
}

async function submit() {
  error.value = '';
  success.value = '';
  const message = invalidMessage();
  if (message) {
    error.value = message;
    return;
  }
  submitting.value = true;
  try {
    await submitApplication({
      gameName: gameName.value.trim(),
      score: score.value as number,
      uid: uid.value.trim(),
      clubId: clubId.value as string,
      reason: reason.value.trim(),
    });
    gameName.value = '';
    score.value = null;
    uid.value = '';
    clubId.value = undefined;
    reason.value = '';
    success.value = '提交成功';
  } catch (cause) {
    error.value = errorMessage(cause, '提交失败');
  } finally {
    submitting.value = false;
  }
}
</script>

