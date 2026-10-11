<template>
  <div class="auth-page">
    <div class="auth-wrap">
      <BrandMark />
      <el-card shadow="hover">
        <template #header>
          <strong>登录</strong>
        </template>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="邮箱">
            <el-input v-model="email" type="email" autocomplete="username" placeholder="name@example.com" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="password" type="password" show-password autocomplete="current-password" />
          </el-form-item>
          <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
          <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">登录</el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage, login } from '../api/client';
import { useAuth } from '../composables/auth';
import BrandMark from '../components/BrandMark.vue';

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
    const result = await login(email.value, password.value);
    auth.setSession(result.token, result.user);
    await router.push('/');
  } catch (cause) {
    error.value = errorMessage(cause, '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>
