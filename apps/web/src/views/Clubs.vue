<template>
    <div class="page-head">
      <div>
        <h1>创建俱乐部</h1>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
    <el-card shadow="never">
      <el-table v-loading="loading" :data="clubs" empty-text="还没有俱乐部">
        <el-table-column prop="name" label="俱乐部名称" min-width="140" />
        <el-table-column label="会长" min-width="120">
          <template #default="{ row }">{{ row.leader || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row as ClubItem)">编辑</el-button>
            <el-button link type="danger" @click="remove(row as ClubItem)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="creating" title="新建俱乐部" width="420px" @closed="resetCreate">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="俱乐部名称" required>
          <el-input v-model="name" maxlength="40" />
        </el-form-item>
        <el-form-item label="会长">
          <el-input v-model="leader" maxlength="40" placeholder="可留空" />
        </el-form-item>
        <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="editing" title="编辑俱乐部" width="420px">
      <el-form label-position="top">
        <el-form-item label="俱乐部名称" required>
          <el-input v-model="editName" maxlength="40" />
        </el-form-item>
        <el-form-item label="会长">
          <el-input v-model="editLeader" maxlength="40" placeholder="可留空" />
        </el-form-item>
        <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { createClub, deleteClub, errorMessage, listClubs, updateClub, type ClubItem } from '../api/client';

const clubs = ref<ClubItem[]>([]);
const name = ref('');
const leader = ref('');
const error = ref('');
const formError = ref('');
const loading = ref(true);
const saving = ref(false);
const creating = ref(false);
const editing = ref(false);
const editId = ref('');
const editName = ref('');
const editLeader = ref('');

async function load() {
  loading.value = true;
  try {
    clubs.value = await listClubs();
  } catch (cause) {
    error.value = errorMessage(cause, '俱乐部加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCreate() {
  formError.value = '';
  name.value = '';
  leader.value = '';
  creating.value = true;
}

function resetCreate() {
  formError.value = '';
  name.value = '';
  leader.value = '';
}

async function submit() {
  saving.value = true;
  formError.value = '';
  try {
    await createClub(name.value, leader.value);
    creating.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

function openEdit(row: ClubItem) {
  formError.value = '';
  editId.value = row.id;
  editName.value = row.name;
  editLeader.value = row.leader ?? '';
  editing.value = true;
}

async function saveEdit() {
  saving.value = true;
  formError.value = '';
  try {
    await updateClub(editId.value, { name: editName.value, leader: editLeader.value });
    editing.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: ClubItem) {
  try {
    await ElMessageBox.confirm(`删除俱乐部「${row.name}」？已有人员时不能删除。`, '删除俱乐部', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteClub(row.id);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}
</script>
