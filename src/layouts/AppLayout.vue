<template>
  <q-layout view="hHh LpR lFf" class="ink-layout">
    <app-header :toggle-left-drawer="toggleLeftDrawer" />

    <app-drawer :left-drawer-open="leftDrawerOpen" />

    <q-page-container class="ink-page-container">
      <transition name="ink-fade">
        <div v-if="globalLoading" class="ink-loading-overlay" key="loading">
          <div class="ink-loading-mark" aria-hidden="true" />
          <div class="ink-loading-label">Loading…</div>
        </div>
      </transition>

      <!-- Enter-only fade — leave is instant to avoid route freezes -->
      <router-view v-slot="{ Component }">
        <transition name="ink-page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, provide, ref, watch } from 'vue';
import AppHeader from 'layouts/AppHeader.vue';
import AppDrawer from 'layouts/AppDrawer.vue';
import {
  TOGGLE_LAYOUT_LEFT_DRAWER_FUNC,
  TOGGLE_LAYOUT_LEFT_DRAWER_REF,
} from 'src/const/InjectionKey';
import { useRoute } from 'vue-router';
import { useThemeStore } from 'stores/themeStore';
import { useRssInfoStore } from 'stores/rssInfoStore';
import { useQuasar } from 'quasar';
import { electronClient } from 'src/services/electronClient';

const route = useRoute();
const $q = useQuasar();
const themeStore = useThemeStore();
const rssInfoStore = useRssInfoStore();

const leftDrawerOpen = ref(true);
const globalLoading = ref(false);

const isDarkMode = computed(() => themeStore.isDarkMode);

watch(
  isDarkMode,
  (val) => {
    $q.dark.set(val);
  },
  { immediate: true },
);

const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value;
};

provide(TOGGLE_LAYOUT_LEFT_DRAWER_REF, leftDrawerOpen);
provide(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, toggleLeftDrawer);

const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && (event.key === 'b' || event.key === '\\')) {
    event.preventDefault();
    toggleLeftDrawer();
  }
  if (event.key === 'Escape' && leftDrawerOpen.value && window.innerWidth < 1024) {
    leftDrawerOpen.value = false;
  }
};

onMounted(() => {
  themeStore.initializeTheme();
  themeStore.listenToSystemThemeChange();

  void rssInfoStore.init().then(() => {
    void (async () => {
      try {
        await electronClient.syncStart();
        await rssInfoStore.refresh();
      } catch (e) {
        console.warn('[AppLayout] Background sync (silent):', e);
      }
    })();
  });

  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.ink-layout {
  background: var(--ink-neutral);
  color: var(--ink-on-surface);
  font-family: var(--ink-font-sans);
}

.ink-page-container {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-neutral);
  width: 100%;
}

.ink-loading-overlay {
  position: fixed;
  inset: var(--ink-header-h) 0 0 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ink-space-md);
  background: color-mix(in srgb, var(--ink-neutral) 88%, transparent);
  backdrop-filter: blur(2px);
}

.ink-loading-mark {
  width: 28px;
  height: 28px;
  border: 2px solid var(--ink-border);
  border-top-color: var(--ink-tertiary);
  border-radius: 50%;
  animation: ink-spin 0.7s linear infinite;
}

.ink-loading-label {
  font-size: var(--ink-meta);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-secondary);
}

@keyframes ink-spin {
  to {
    transform: rotate(360deg);
  }
}

.ink-page-enter-active {
  transition: opacity 0.15s ease;
}
.ink-page-enter-from {
  opacity: 0;
}
.ink-page-leave-active {
  transition: none;
  display: none;
}

.ink-fade-enter-active,
.ink-fade-leave-active {
  transition: opacity 0.15s ease;
}
.ink-fade-enter-from,
.ink-fade-leave-to {
  opacity: 0;
}
</style>
