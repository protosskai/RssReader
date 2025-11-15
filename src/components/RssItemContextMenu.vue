<template>
  <q-menu
    v-model="showContextMenu"
    :offset="offset"
    @hide="showContextMenu = false"
    :context-menu="true"
  >
    <q-list class="context-menu-list">
      <q-item v-for="item in contextMenuInfo" :key="item.title" clickable @click="item.clickHandler?.()">
        <q-item-section>
          <q-item-label>
            <template v-if="item.icon">
              <q-icon :name="item.icon" class="mr-2" />
            </template>
            {{ item.title }}
          </q-item-label>
        </q-item-section>
      </q-item>
      <q-separator v-if="item.separator" v-for="(item, index) in contextMenuInfo.filter(i => i.separator)" :key="index" />
    </q-list>
  </q-menu>
</template>

<script setup lang="ts">
import {ref} from "vue";
import {useRssInfoStore} from "stores/rssInfoStore";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useQuasar} from "quasar";
import {RssInfoItem} from "src/common/RssInfoItem";

const props = defineProps<{
  rssItem: RssInfoItem;
  folderName: string;
}>();

const emit = defineEmits<{
  closed: [];
}>();

const showContextMenu = ref(false);
const offset = ref([0, 0]);

const systemDialogStore = useSystemDialogStore();
const {toggleEditSubscriptionDialog, setEditSubscriptionOldRssInfo} = systemDialogStore;
const rssInfoStore = useRssInfoStore();
const {removeRssSubscription} = rssInfoStore;
const $q = useQuasar();

interface ContextMenuItem {
  title: string;
  icon?: string;
  clickHandler?: () => void;
  separator?: boolean;
}

const onRefresh = async () => {
  try {
    showContextMenu.value = false;
    $q.loading.show({
      message: '正在刷新订阅...'
    });
    // 调用后端API刷新特定RSS订阅
    if (window.electronAPI.fetchRssIndexList) {
      await window.electronAPI.fetchRssIndexList(props.rssItem.id);
      $q.notify({
        message: '订阅已更新',
        color: 'positive',
        position: 'top'
      });
    } else {
      $q.notify({
        message: '刷新功能暂未实现',
        color: 'info',
        position: 'top'
      });
    }
  } catch (error) {
    console.error('刷新订阅失败:', error);
    $q.notify({
      message: '刷新订阅失败',
      color: 'negative',
      position: 'top'
    });
  } finally {
    $q.loading.hide();
  }
};

const onEdit = () => {
  setEditSubscriptionOldRssInfo({
    rssId: props.rssItem.id,
    title: props.rssItem.title,
    feedUrl: props.rssItem.feedUrl,
    htmlUrl: props.rssItem.htmlUrl,
    folderName: props.folderName
  });
  toggleEditSubscriptionDialog();
  showContextMenu.value = false;
};

const onDelete = async () => {
  try {
    // 弹出确认对话框
    const confirmed = await $q.dialog({
      title: '确认删除',
      message: `确定要删除订阅 "${props.rssItem.title}" 吗？`,
      cancel: true,
      persistent: true
    });
    
    if (confirmed) {
      showContextMenu.value = false;
      await removeRssSubscription(props.rssItem.id);
      $q.notify({
        message: '订阅已删除',
        color: 'positive',
        position: 'top'
      });
    }
  } catch (error) {
    console.error('删除订阅失败:', error);
    $q.notify({
      message: '删除订阅失败',
      color: 'negative',
      position: 'top'
    });
  }
};

const onMarkedRead = async () => {
  try {
    showContextMenu.value = false;
    // 调用后端API将此订阅源的所有文章标记为已读
    if (window.electronAPI.markRssAsRead) {
      await window.electronAPI.markRssAsRead(props.rssItem.id);
      $q.notify({
        message: '已标记所有文章为已读',
        color: 'positive',
        position: 'top'
      });
    } else {
      $q.notify({
        message: '标记已读功能暂未实现',
        color: 'info',
        position: 'top'
      });
    }
  } catch (error) {
    console.error('标记已读失败:', error);
    $q.notify({
      message: '标记已读失败',
      color: 'negative',
      position: 'top'
    });
  }
};

const onMoveToFolder = () => {
  // 打开移动到文件夹对话框
  systemDialogStore.setMoveSubscriptionParams({
    rssId: props.rssItem.id,
    feedUrl: props.rssItem.feedUrl,
    currentFolder: props.folderName
  });
  systemDialogStore.toggleMoveSubscriptionDialog();
  showContextMenu.value = false;
};

const contextMenuInfo: ContextMenuItem[] = [
  {
    title: '刷新',
    clickHandler: onRefresh,
    icon: 'refresh'
  },
  {
    title: '标记为已读',
    clickHandler: onMarkedRead,
    icon: 'mark_email_read'
  },
  {
    separator: true
  },
  {
    title: '编辑',
    clickHandler: onEdit,
    icon: 'edit'
  },
  {
    title: '移动到文件夹',
    clickHandler: onMoveToFolder,
    icon: 'folder_move'
  },
  {
    separator: true
  },
  {
    title: '删除',
    clickHandler: onDelete,
    icon: 'delete'
  }
];

// 显示上下文菜单的方法
defineExpose({
  show(x: number, y: number) {
    offset.value = [x, y];
    showContextMenu.value = true;
  },
  hide() {
    showContextMenu.value = false;
  }
});
</script>

<style scoped>
.context-menu-list {
  min-width: 180px;
  max-width: 240px;
}
</style>