<template>
  <q-layout view="hHh lpR fFf">
    <app-header :toggle-left-drawer="toggleLeftDrawer"/>

    <app-drawer :left-drawer-open="leftDrawerOpen"/>

    <q-page-container
      class="layout-page-container"
      :class="{ 'layout-page-container--dark': isDarkMode }"
    >
      <!-- Global loading overlay -->
      <transition name="page-fade">
        <div v-if="globalLoading" class="layout-loading-overlay">
          <q-spinner-dots size="40px" color="primary"/>
          <div class="q-mt-sm text-grey-6 text-caption">加载中...</div>
        </div>
      </transition>

      <!-- Page content with route transition -->
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.fullPath"/>
        </transition>
      </router-view>
    </q-page-container>

  </q-layout>
</template>

<script setup lang="ts">
import {computed, onMounted, onBeforeUnmount, provide, ref, watch} from 'vue'
import AppHeader from "layouts/AppHeader.vue";
import AppDrawer from "layouts/AppDrawer.vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, TOGGLE_LAYOUT_LEFT_DRAWER_REF} from "src/const/InjectionKey";
import {useRoute} from "vue-router";
import {useThemeStore} from "stores/themeStore";
import {useQuasar} from "quasar";

const route = useRoute();
const $q = useQuasar();
const themeStore = useThemeStore();

const leftDrawerOpen = ref(true); // 默认打开抽屉
const globalLoading = ref(false);

// Dark mode reactivity
const isDarkMode = computed(() => themeStore.isDarkMode);

// Watch dark mode and apply Quasar's dark class
watch(isDarkMode, (val) => {
  $q.dark.set(val);
}, { immediate: true });

// Toggle left drawer
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

provide(TOGGLE_LAYOUT_LEFT_DRAWER_REF, leftDrawerOpen);
provide(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, toggleLeftDrawer);

/* ---- Keyboard Accessibility ---- */
const handleKeydown = (event: KeyboardEvent) => {
  // Ctrl+B or Ctrl+\\ : Toggle sidebar
  if ((event.ctrlKey || event.metaKey) && (event.key === 'b' || event.key === '\\')) {
    event.preventDefault();
    toggleLeftDrawer();
  }

  // Escape: Close drawer if open
  if (event.key === 'Escape' && leftDrawerOpen.value) {
    // On mobile/overlay mode, pressing Escape should close the drawer
    // Quasar q-drawer handles this, but we can force-close on small screens
    if (window.innerWidth < 1024) {
      leftDrawerOpen.value = false;
    }
  }
};

onMounted(() => {
  // Initialize theme
  themeStore.initializeTheme();
  themeStore.listenToSystemThemeChange();

  // Register global keyboard handler
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});

</script>

<style lang="scss" scoped>
/* ---- Page Container ---- */
.layout-page-container {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-height: calc(100vh - 45px); /* minus header bar height */
  padding: 0;
  background-color: #f5f5f5;
  transition: background-color 0.3s ease;

  &--dark {
    background-color: #1a1a2e;
  }

  /* Ensure the router-view component fills the container */
  :deep(> .q-page) {
    width: 100%;
  }
}

/* ---- Global Loading Overlay ---- */
.layout-loading-overlay {
  position: fixed;
  top: 45px; /* below header */
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(245, 245, 245, 0.85);
  z-index: 999;
  transition: background-color 0.3s ease;

  .layout-page-container--dark & {
    background-color: rgba(26, 26, 46, 0.85);
  }
}

/* ---- Route Transitions ---- */
.page-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---- Responsive ---- */
@media (max-width: 600px) {
  .layout-page-container {
    min-height: calc(100vh - 45px);
  }

  .layout-loading-overlay {
    top: 45px;
  }
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: none;
  }
}
</style>
