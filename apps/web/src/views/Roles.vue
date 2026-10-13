<template>
  <div class="page-head">
    <div>
      <h1>角色管理</h1>
    </div>
    <el-button type="primary" :icon="Plus" @click="openCreate">新增</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-table v-loading="loading" :data="roles" empty-text="还没有角色">
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="menuCount" label="菜单数量" width="120" />
      <el-table-column prop="clubCount" label="俱乐部数量" width="120" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <template v-if="!(row as RoleItem).isSuper">
            <el-button link type="primary" @click="openEdit(row as RoleItem)">编辑</el-button>
            <el-button link type="danger" @click="remove(row as RoleItem)">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="opening" :title="editId ? '编辑角色' : '新建角色'" width="520px" @closed="reset">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="名称" required>
        <el-input v-model="name" maxlength="40" />
      </el-form-item>
      <el-form-item label="菜单" class="menu-field">
        <div v-for="group in MENU_CATALOG" :key="group.key" class="menu-group">
          <div class="menu-group-title">{{ group.title }}</div>
          <el-checkbox-group v-model="menuKeys">
            <el-checkbox v-for="item in group.children" :key="item.key" :value="item.key">
              {{ item.title }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </el-form-item>
      <el-form-item label="俱乐部">
        <el-checkbox-group v-model="clubIds">
          <el-checkbox v-for="club in clubs" :key="club.id" :value="club.id">{{ club.name }}</el-checkbox>
        </el-checkbox-group>
        <el-text v-if="clubs.length === 0" type="info">当前没有可分配的俱乐部</el-text>
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="opening = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { MENU_CATALOG } from '@ocr/shared-types';
import {
  createRole,
  deleteRole,
  errorMessage,
  listClubs,
  listRoles,
  updateRole,
  type ClubItem,
  type RoleItem,
} from '../api/client';

const roles = ref<RoleItem[]>([]);
const clubs = ref<ClubItem[]>([]);
const error = ref('');
const formError = ref('');
const loading = ref(true);
const saving = ref(false);
const opening = ref(false);
const editId = ref('');
const name = ref('');
const menuKeys = ref<string[]>([]);
const clubIds = ref<string[]>([]);

async function load() {
  loading.value = true;
  try {
    const [roleRows, clubRows] = await Promise.all([listRoles(), listClubs()]);
    roles.value = roleRows;
    clubs.value = clubRows;
  } catch (cause) {
    error.value = errorMessage(cause, '角色加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function reset() {
  formError.value = '';
}

function openCreate() {
  formError.value = '';
  editId.value = '';
  name.value = '';
  menuKeys.value = [];
  clubIds.value = [];
  opening.value = true;
}

function openEdit(row: RoleItem) {
  formError.value = '';
  editId.value = row.id;
  name.value = row.name;
  menuKeys.value = [...row.menuKeys];
  const visible = new Set(clubs.value.map((club) => club.id));
  clubIds.value = row.clubIds.filter((id) => visible.has(id));
  opening.value = true;
}

async function submit() {
  saving.value = true;
  formError.value = '';
  const body = { name: name.value, menuKeys: menuKeys.value, clubIds: clubIds.value };
  try {
    if (editId.value) await updateRole(editId.value, body);
    else await createRole(body);
    opening.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: RoleItem) {
  try {
    await ElMessageBox.confirm(`删除角色「${row.name}」？仍有账号使用时不能删除。`, '删除角色', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteRole(row.id);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}
</script>

<style scoped>
.menu-field :deep(.el-form-item__content) {
  display: block;
}
.menu-group + .menu-group {
  margin-top: 10px;
}
.menu-group-title {
  margin-bottom: 2px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 22px;
}
.menu-group :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
}
.menu-group :deep(.el-checkbox) {
  margin-right: 0;
}
</style>
