import { onMounted, onUnmounted, ref } from 'vue';

const QUERY = '(max-width: 800px)';

export function useNarrow() {
  const narrow = ref(typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  let media: MediaQueryList | null = null;

  function onChange() {
    narrow.value = media?.matches ?? false;
  }

  onMounted(() => {
    media = window.matchMedia(QUERY);
    narrow.value = media.matches;
    media.addEventListener('change', onChange);
  });

  onUnmounted(() => media?.removeEventListener('change', onChange));

  return narrow;
}
