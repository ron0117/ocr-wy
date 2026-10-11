<template>
  <div class="page-head">
    <div>
      <h1>账号管理</h1>
    </div>
    <el-button type="primary" :icon="Plus" @click="openCreate">新增</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-table v-loading="loading" :data="accounts" empty-text="还没有账号">
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="名称" min-width="120">
        <template #default="{ row }">{{ row.name || '—' }}</template>
      </el-table-column>
      <el-table-column label="角色" min-width="140">
        <template #default="{ row }">{{ row.roleName || '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ row.disabled ? '停用' : '启用' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as AccountItem)">编辑</el-button>
          <el-button link type="danger" @click="remove(row as AccountItem)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="creating" title="新建账号" width="460px" @closed="resetCreate">
    <el-form label-position="top" @submit.prevent="submitCreate">
      <el-form-item label="邮箱" required>
        <el-input v-model="form.email" type="email" />
      </el-form-item>
      <el-form-item label="密码" required>
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.name" maxlength="40" placeholder="可留空" />
      </el-form-item>
      <el-form-item label="角色" required>
        <el-select v-model="form.roleId" placeholder="选择角色" style="width: 100%">
          <el-option v-for="role in assignableRoles" :key="role.id" :label="role.name" :value="role.id" />
        </el-select>
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="creating = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
    </template>
  </el-dialog>
  <el-dialog v-model="editing" title="编辑账号" width="460px">
    <el-form label-position="top">
      <el-form-item label="邮箱">
        <el-input :model-value="form.email" disabled />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="form.password" type="password" show-password placeholder="留空则不修改" />
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.name" maxlength="40" placeholder="可留空" />
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="form.roleId" placeholder="选择角色" style="width: 100%">
          <el-option v-for="role in assignableRoles" :key="role.id" :label="role.name" :value="role.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="停用">
        <el-switch v-model="form.disabled" />
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="editing = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  createAccount,
  deleteAccount,
  errorMessage,
  listAccounts,
  listRoles,
  updateAccount,
  type AccountItem,
  type RoleItem,
} from '../api/client';

const accounts = ref<AccountItem[]>([]);
const roles = ref<RoleItem[]>([]);
const error = ref('');
const formError = ref('');
const loading = ref(true);
const saving = ref(false);
const creating = ref(false);
const editing = ref(false);
const editId = ref('');
const form = reactive({ email: '', password: '', name: '', roleId: '', disabled: false });
const assignableRoles = computed(() => roles.value.filter((role) => !role.isSuper));

async function load() {
  loading.value = true;
  try {
    const [accountRows, roleRows] = await Promise.all([listAccounts(), listRoles()]);
    accounts.value = accountRows;
    roles.value = roleRows;
  } catch (cause) {
    error.value = errorMessage(cause, '账号加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function resetForm() {
  form.email = '';
  form.password = '';
  form.name = '';
  form.roleId = '';
  form.disabled = false;
  formError.value = '';
}

function openCreate() {
  resetForm();
  creating.value = true;
}

function resetCreate() {
  formError.value = '';
}

function openEdit(row: AccountItem) {
  formError.value = '';
  editId.value = row.id;
  form.email = row.email;
  form.password = '';
  form.name = row.name ?? '';
  form.roleId = row.roleId ?? '';
  form.disabled = row.disabled;
  editing.value = true;
}

async function submitCreate() {
  saving.value = true;
  formError.value = '';
  try {
    await createAccount({
      email: form.email,
      password: form.password,
      name: form.name || undefined,
      roleId: form.roleId,
    });
    creating.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function submitEdit() {
  saving.value = true;
  formError.value = '';
  try {
    await updateAccount(editId.value, {
      name: form.name,
      roleId: form.roleId || undefined,
      disabled: form.disabled,
      password: form.password,
    });
    editing.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: AccountItem) {
  try {
    await ElMessageBox.confirm(`删除账号「${row.email}」？`, '删除账号', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteAccount(row.id);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}
</script>
