<template>
  <q-header class="ink-header" elevated>
    <q-bar class="ink-header-bar q-electron-drag">
      <q-btn
        dense
        flat
        round
        icon="menu"
        class="q-electron-drag--exception"
        aria-label="Toggle sidebar"
        @click="toggleLeftDrawer?.()"
      >
        <q-tooltip>Sidebar</q-tooltip>
      </q-btn>

      <div class="ink-brand q-electron-drag--exception" @click="openHomePage" role="button" tabindex="0" @keydown.enter="openHomePage">
        <span class="ink-brand__mark" aria-hidden="true" />
        <span class="ink-brand__name">{{ SOFT_NAME }}</span>
      </div>

      <q-space />

      <div class="ink-header-actions q-electron-drag--exception">
        <q-btn dense flat round icon="refresh" :disable="rssInfoStore.isLoading" aria-label="Refresh" @click="handleRefresh">
          <q-tooltip>{{ rssInfoStore.isLoading ? 'Refreshing…' : 'Refresh feeds' }}</q-tooltip>
          <q-spinner v-if="rssInfoStore.isLoading" size="1em" class="absolute-center" color="white" />
        </q-btn>

        <q-btn dense flat round icon="add" aria-label="Add">
          <q-menu transition-show="jump-down" transition-hide="jump-up" class="ink-menu">
            <q-list style="min-width: 200px" dense>
              <q-item clickable v-close-popup @click="openAddSubscription" role="menuitem">
                <q-item-section avatar><q-icon name="rss_feed" size="18px" /></q-item-section>
                <q-item-section>Add subscription</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="openAddFolder" role="menuitem">
                <q-item-section avatar><q-icon name="create_new_folder" size="18px" /></q-item-section>
                <q-item-section>New folder</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn dense flat round icon="search" aria-label="Search" @click="handleSearchClick">
          <q-tooltip>Search (⌘/Ctrl+F)</q-tooltip>
        </q-btn>

        <q-btn dense flat round icon="star_outline" aria-label="Favorites" @click="openFavorites">
          <q-tooltip>Favorites</q-tooltip>
        </q-btn>

        <q-btn dense flat round icon="settings" aria-label="Settings" @click="openSettings">
          <q-tooltip>Settings</q-tooltip>
        </q-btn>

        <q-btn dense flat round icon="home" aria-label="Home" @click="openHomePage">
          <q-tooltip>Home</q-tooltip>
        </q-btn>

        <q-separator vertical dark class="ink-header-sep" />

        <q-btn dense flat round icon="minimize" aria-label="Minimize" @click="minimize" />
        <q-btn dense flat round icon="close" aria-label="Close" @click="closeApp" />
      </div>
    </q-bar>

    <q-slide-transition>
      <div
        v-if="refreshError"
        class="ink-error-banner"
        role="alert"
        @click="handleRefresh"
      >
        <q-icon name="error_outline" size="14px" class="q-mr-xs" />
        {{ refreshError }}
        <span class="ink-error-banner__retry">Retry</span>
      </div>
    </q-slide-transition>

    <add-subscription-dialog />
    <add-folder-dialog />
    <edit-subscription-dialog />
    <move-folder-dialog />
  </q-header>
</template>

<script setup lang="ts">
import { inject, ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { electronClient } from 'src/services/electronClient';
import {
  TOGGLE_LAYOUT_LEFT_DRAWER_FUNC,
  TOGGLE_LAYOUT_LEFT_DRAWER_REF,
} from 'src/const/InjectionKey';
import AddSubscriptionDialog from 'components/AddSubscriptionDialog.vue';
import { SOFT_NAME } from 'src/const/string';
import AddFolderDialog from 'components/AddFolderDialog.vue';
import EditSubscriptionDialog from 'components/EditSubscriptionDialog.vue';
import MoveFolderDialog from 'components/MoveFolderDialog.vue';
import { useSystemDialogStore } from 'stores/systemDialogStore';
import { useRssInfoStore } from 'stores/rssInfoStore';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const router = useRouter();
const rssInfoStore = useRssInfoStore();
const systemDialogStore = useSystemDialogStore();
const { openAddSubscriptionDialog, openAddFolderDialog } = systemDialogStore;
const toggleLeftDrawer = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC);
const leftDrawerOpenRef = inject<Ref<boolean> | undefined>(TOGGLE_LAYOUT_LEFT_DRAWER_REF);

const refreshError = ref<string | null>(null);

const openAddSubscription = () => openAddSubscriptionDialog();
const openAddFolder = () => openAddFolderDialog();

const handleRefresh = async () => {
  refreshError.value = null;
  await rssInfoStore.refresh();
  if (rssInfoStore.error) {
    refreshError.value = rssInfoStore.error;
    $q.notify({
      message: 'Refresh failed: ' + rssInfoStore.error,
      color: 'negative',
      position: 'top',
      timeout: 3000,
    });
  } else {
    $q.notify({
      message: 'Feeds refreshed',
      color: 'positive',
      position: 'top',
      timeout: 1200,
    });
  }
};

const openHomePage = () => {
  void router.push({ name: 'Home' });
};

const handleSearchClick = () => {
  if (leftDrawerOpenRef && leftDrawerOpenRef.value === false) {
    leftDrawerOpenRef.value = true;
  } else if (leftDrawerOpenRef?.value !== true && typeof toggleLeftDrawer === 'function') {
    toggleLeftDrawer();
  }
  requestAnimationFrame(() => {
    setTimeout(() => {
      const input =
        (document.querySelector('.q-drawer input') as HTMLInputElement | null) ||
        (document.querySelector('input[placeholder*="搜索"], input[placeholder*="Search"]') as HTMLInputElement | null);
      if (input) {
        input.focus();
        input.select?.();
      }
    }, 120);
  });
};

const openFavorites = () => {
  void router.push({ name: 'Favorite' });
};

const openSettings = () => {
  void router.push({ name: 'Setting' });
};

const closeApp = () => {
  if (process.env.MODE === 'electron') electronClient.close();
};

const minimize = () => {
  if (process.env.MODE === 'electron') electronClient.minimize();
};
</script>

<style lang="scss" scoped>
.ink-header {
  background: var(--ink-primary) !important;
  color: var(--ink-on-primary);
  box-shadow: none !important;
  border-bottom: 1px solid color-mix(in srgb, var(--ink-on-primary) 12%, transparent);
}

.ink-header-bar {
  height: var(--ink-header-h);
  padding: 0 var(--ink-space-sm);
  background: transparent;
  color: inherit;

  :deep(.q-btn) {
    color: var(--ink-on-primary);
    opacity: 0.92;
  }
  :deep(.q-btn:hover) {
    opacity: 1;
    background: color-mix(in srgb, var(--ink-on-primary) 10%, transparent);
  }
}

.ink-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--ink-radius-sm);
  user-select: none;

  &:hover {
    background: color-mix(in srgb, var(--ink-on-primary) 8%, transparent);
  }

  &__mark {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--ink-tertiary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ink-tertiary) 35%, transparent);
  }

  &__name {
    font-family: var(--ink-font-serif);
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ink-on-primary);
  }
}

.ink-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ink-header-sep {
  height: 18px;
  margin: 0 6px;
  background: color-mix(in srgb, var(--ink-on-primary) 22%, transparent);
}

.ink-error-banner {
  background: var(--ink-negative);
  color: #fff;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  padding: 4px 12px;
  cursor: pointer;

  &__retry {
    margin-left: 8px;
    text-decoration: underline;
    font-weight: 600;
  }
}
</style>

<style lang="scss">
/* Non-scoped menu surface (portaled) */
.ink-menu {
  .q-list {
    background: var(--ink-surface);
    color: var(--ink-on-surface);
    border: 1px solid var(--ink-border);
    border-radius: var(--ink-radius-md);
  }
}
</style>
