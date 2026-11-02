<template>
  <div class="page-head">
    <div>
      <h1>Wiki 内容</h1>
      <p>删除 Wiki 站上的分享连招码与玩家攻略。删除后前台立即不可访问。</p>
    </div>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="连招码" name="shares">
        <el-table v-loading="sharesLoading" :data="shares" empty-text="暂无连招码" row-key="id">
          <el-table-column prop="id" label="ID" width="120" />
          <el-table-column label="标题" min-width="160">
            <template #default="{ row }">
              {{ (row as WikiShareListItem).title || '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="authorName" label="作者" width="100" />
          <el-table-column prop="pathwayProfessionLabel" label="途径" width="100" />
          <el-table-column prop="scenarioName" label="场景" width="100" />
          <el-table-column prop="viewCount" label="浏览" width="80" />
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">{{ formatTime((row as WikiShareListItem).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeShare(row as WikiShareListItem)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            v-model:current-page="sharePage"
            :page-size="sharePageSize"
            :total="shareTotal"
            layout="total, prev, pager, next"
            @current-change="loadShares"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="玩家攻略" name="articles">
        <el-table v-loading="articlesLoading" :data="articles" empty-text="暂无攻略" row-key="slug">
          <el-table-column prop="title" label="标题" min-width="180" />
          <el-table-column prop="authorName" label="作者" width="120" />
          <el-table-column prop="slug" label="Slug" min-width="160" show-overflow-tooltip />
          <el-table-column prop="viewCount" label="浏览" width="80" />
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">{{ formatTime((row as WikiArticleListItem).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeArticle(row as WikiArticleListItem)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus';
import { onMounted, ref } from 'vue';
import {
  deleteWikiArticle,
  deleteWikiShare,
  errorMessage,
  listWikiArticles,
  listWikiShares,
  type WikiArticleListItem,
  type WikiShareListItem,
} from '../api/client';
import { formatTime } from '../lib/format';

const tab = ref<'shares' | 'articles'>('shares');
const error = ref('');

const shares = ref<WikiShareListItem[]>([]);
const sharesLoading = ref(false);
const sharePage = ref(1);
const sharePageSize = 20;
const shareTotal = ref(0);

const articles = ref<WikiArticleListItem[]>([]);
const articlesLoading = ref(false);

async function loadShares(page = sharePage.value) {
  sharesLoading.value = true;
  error.value = '';
  try {
    const data = await listWikiShares(page, sharePageSize);
    shares.value = data.items;
    sharePage.value = data.page;
    shareTotal.value = data.total;
  } catch (cause) {
    error.value = errorMessage(cause, '连招码列表加载失败');
  } finally {
    sharesLoading.value = false;
  }
}

async function loadArticles() {
  articlesLoading.value = true;
  error.value = '';
  try {
    articles.value = await listWikiArticles(100);
  } catch (cause) {
    error.value = errorMessage(cause, '攻略列表加载失败');
  } finally {
    articlesLoading.value = false;
  }
}

function onTabChange(name: string | number) {
  if (name === 'articles' && articles.value.length === 0) void loadArticles();
}

async function removeShare(row: WikiShareListItem) {
  try {
    await ElMessageBox.confirm(`确定删除连招码「${row.id}」？此操作不可恢复。`, '删除连招码', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteWikiShare(row.id);
    await loadShares();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}

async function removeArticle(row: WikiArticleListItem) {
  try {
    await ElMessageBox.confirm(`确定删除攻略「${row.title}」？此操作不可恢复。`, '删除攻略', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteWikiArticle(row.slug);
    await loadArticles();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}

onMounted(() => {
  void loadShares();
});
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
