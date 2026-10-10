<template>
  <div class="auth-page">
    <div class="auth-wrap">
      <BrandMark />
      <el-card shadow="hover">
        <template #header>
          <strong>加入俱乐部</strong>
        </template>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="名称">
            <el-input v-model="name" maxlength="40" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="email" type="email" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="password" type="password" show-password minlength="8" />
          </el-form-item>
          <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
          <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">创建账号</el-button>
        </el-form>
        <div style="margin-top: 14px">
          <el-text type="info">已有账号？</el-text>
          <el-button link type="primary" @click="router.push('/login')">登录</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage, register } from '../api/client';
import { useAuth } from '../composables/auth';
import BrandMark from '../components/BrandMark.vue';

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const auth = useAuth();

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const result = await register(email.value, password.value, name.value);
    auth.setSession(result.token, result.user);
    await router.push('/clubs');
  } catch (cause) {
    error.value = errorMessage(cause, '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>
