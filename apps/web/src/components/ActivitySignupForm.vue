<template>
  <div class="signup-form public-form-wrap" :class="{ embedded }">
    <el-card shadow="hover">
      <template v-if="activityTitle" #header>
        <strong>{{ activityTitle }}</strong>
        <p v-if="startsAt" class="signup-sub">开始时间：{{ startsAt }}</p>
      </template>
      <el-alert v-if="closed" title="活动已结束，无法报名" type="warning" show-icon :closable="false" style="margin-bottom: 12px" />
      <el-form label-position="top" size="large" @submit.prevent="onSubmit">
        <el-form-item label="俱乐部" required>
          <el-select v-model="clubId" placeholder="请选择俱乐部" style="width: 100%" :disabled="closed || loading">
            <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="非凡者名称" required>
          <el-input v-model="playerName" maxlength="64" :disabled="closed || loading" />
        </el-form-item>
        <el-form-item label="当前最高评分" required>
          <el-input-number
            v-model="score"
            :min="1"
            :max="999999"
            :step="1"
            :precision="0"
            controls-position="right"
            style="width: 100%"
            :disabled="closed || loading"
          />
        </el-form-item>
        <el-form-item label="职业" required>
          <el-select v-model="profession" placeholder="请选择职业" style="width: 100%" :disabled="closed || loading">
            <el-option v-for="item in REGISTRATION_PROFESSION_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
        <el-alert v-if="success" :title="success" type="success" show-icon :closable="false" style="margin-bottom: 12px" />
        <el-button type="primary" native-type="submit" :loading="submitting" :disabled="closed || loading" style="width: 100%">
          签到
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { REGISTRATION_PROFESSION_OPTIONS, type RegistrationProfession } from '@ocr/shared-types';
import { errorMessage, fetchPublicActivity, submitPublicRegistration } from '../api/client';

const props = defineProps<{
  activityId: string;
  embedded?: boolean;
}>();

const loading = ref(true);
const submitting = ref(false);
const closed = ref(false);
const activityTitle = ref('');
const startsAt = ref('');
const clubs = ref<Array<{ id: string; name: string }>>([]);
const clubId = ref('');
const playerName = ref('');
const score = ref<number | null>(null);
const profession = ref<RegistrationProfession | ''>('');
const error = ref('');
const success = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const activity = await fetchPublicActivity(props.activityId);
    activityTitle.value = activity.title;
    startsAt.value = new Date(activity.startsAt).toLocaleString('zh-CN', { hour12: false });
    clubs.value = activity.clubs;
    closed.value = activity.status !== 'PUBLISHED';
    if (!clubId.value && clubs.value[0]) clubId.value = clubs.value[0].id;
  } catch (cause) {
    error.value = errorMessage(cause, '活动加载失败');
  } finally {
    loading.value = false;
  }
}

watch(() => props.activityId, () => void load(), { immediate: true });

function validate() {
  if (closed.value) return '活动已结束，无法报名';
  if (!clubId.value) return '请选择俱乐部';
  if (!playerName.value.trim()) return '请填写非凡者名称';
  if (score.value === null || score.value < 1 || score.value > 999999) return '请填写 1–999999 的评分';
  if (!profession.value) return '请选择职业';
  return '';
}

async function onSubmit() {
  error.value = '';
  success.value = '';
  const message = validate();
  if (message) {
    error.value = message;
    return;
  }
  try {
    await ElMessageBox.confirm('确认提交报名信息？', '确认签到', { type: 'info' });
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await submitPublicRegistration(props.activityId, {
      clubId: clubId.value,
      playerName: playerName.value.trim(),
      score: score.value!,
      profession: profession.value as RegistrationProfession,
    });
    success.value = '报名成功';
    playerName.value = '';
    score.value = null;
    profession.value = '';
  } catch (cause) {
    error.value = errorMessage(cause, '报名失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.signup-form.embedded {
  padding: 8px 12px;
}
.signup-sub {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}
</style>
