<template>
  <button class="xiaoyou-launch" type="button" @click="open = !open">小忧</button>
  <section v-show="open" class="xiaoyou-panel">
    <header>
      <div>
        <strong>小忧</strong>
        <span>俱乐部小助手</span>
      </div>
      <div class="xiaoyou-actions">
        <el-button link type="primary" :disabled="sending" @click="startNew">新对话</el-button>
        <el-button link @click="open = false">关闭</el-button>
      </div>
    </header>
    <div ref="scroller" class="xiaoyou-log">
      <p v-if="!messages.length && !sending" class="xiaoyou-empty">{{ callerName }}，小忧在。可以让小忧查某个人的等级，或导出某某俱乐部人员名单。</p>
      <article v-for="item in messages" :key="item.id" :class="['xiaoyou-bubble', item.role]">
        <p>{{ item.content }}</p>
        <el-button
          v-if="item.download"
          size="small"
          type="primary"
          plain
          @click="download(item.download)"
        >
          下载 Excel
        </el-button>
      </article>
      <p v-if="sending || processing" class="xiaoyou-status">
        小忧翻箱倒柜中<span class="xiaoyou-ellipsis" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
    </div>
    <form @submit.prevent="send">
      <el-input
        v-model="text"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        resize="none"
        maxlength="500"
        placeholder="跟小忧说一件事"
        :disabled="sending"
        @keydown="onKeydown"
      />
      <el-button type="primary" native-type="submit" :disabled="sending || !text.trim()">发送</el-button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import {
  currentAssistantSession,
  downloadAssistantExport,
  errorMessage,
  openAssistantSession,
  sendAssistantMessage,
  type AssistantDownload,
  type AssistantMessage,
} from '../api/client';
import { useAuth } from '../composables/auth';

const auth = useAuth();
const callerName = computed(() => auth.state.user?.name?.trim() || '管理员');
const open = ref(false);
const text = ref('');
const sending = ref(false);
const processing = ref(false);
const sessionId = ref<string | null>(null);
const messages = ref<AssistantMessage[]>([]);
const scroller = ref<HTMLElement | null>(null);
let pollTimer: number | null = null;
let viewEpoch = 0;

watch([messages, sending], () => {
  void nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  });
});

watch(open, (visible) => {
  if (!visible) return;
  void reload();
});

onUnmounted(() => stopPoll());

function onKeydown(event: Event | KeyboardEvent) {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  void send();
}

async function reload() {
  if (sending.value) return;
  const epoch = viewEpoch;
  try {
    const session = await currentAssistantSession();
    if (epoch !== viewEpoch || sending.value) return;
    sessionId.value = session?.id ?? null;
    messages.value = session?.messages ?? [];
    processing.value = Boolean(session?.processing);
    if (processing.value) startPoll();
    else stopPoll();
  } catch (error) {
    ElMessage.error(errorMessage(error, '小忧没能打开刚才的对话'));
  }
}

async function startNew() {
  viewEpoch += 1;
  sending.value = true;
  try {
    const session = await openAssistantSession();
    sessionId.value = session.id;
    messages.value = [];
    processing.value = false;
    stopPoll();
  } catch (error) {
    ElMessage.error(errorMessage(error, '小忧没能开始新对话'));
  } finally {
    sending.value = false;
  }
}

async function send() {
  const content = text.value.trim();
  if (!content || sending.value) return;
  const epoch = ++viewEpoch;
  const pendingId = crypto.randomUUID();
  messages.value = [
    ...messages.value,
    {
      id: pendingId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      download: null,
    },
  ];
  text.value = '';
  sending.value = true;
  try {
    if (!sessionId.value) {
      const session = await openAssistantSession();
      sessionId.value = session.id;
    }
    const result = await sendAssistantMessage(sessionId.value, content, crypto.randomUUID());
    if (epoch !== viewEpoch) return;
    const session = await currentAssistantSession();
    const saved = session?.messages ?? [];
    if (session?.id === sessionId.value && saved.some((item) => item.role === 'user' && item.content === content)) {
      messages.value = saved;
      processing.value = session.processing;
    } else {
      messages.value = [...messages.value, result.message];
    }
  } catch (error) {
    ElMessage.error(await readError(error));
    await keepOrSync();
  } finally {
    sending.value = false;
  }
}

async function keepOrSync() {
  try {
    const session = await currentAssistantSession();
    const last = session?.messages.at(-1);
    const localLast = messages.value.at(-1);
    if (last?.role === 'assistant' && last.id !== localLast?.id) {
      sessionId.value = session?.id ?? sessionId.value;
      messages.value = session?.messages ?? messages.value;
    }
  } catch {
    // 用户刚发出的那句留在对话框里
  }
}

async function download(file: AssistantDownload) {
  try {
    await downloadAssistantExport(file.exportId, file.fileName);
  } catch (error) {
    ElMessage.error(await readError(error));
  }
}

function startPoll() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => {
    void reload();
  }, 1500);
}

function stopPoll() {
  if (pollTimer === null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function readError(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const parsed = JSON.parse(await error.response.data.text()) as { message?: string };
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      return '小忧这次没办成';
    }
  }
  return errorMessage(error, '小忧这次没办成');
}
</script>
