<template>
  <div class="public-page">
    <ActivitySignupForm :activity-id="activityId" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ActivitySignupForm from '../components/ActivitySignupForm.vue';

const route = useRoute();
const activityId = computed(() => String(route.params.activityId ?? ''));
</script>
