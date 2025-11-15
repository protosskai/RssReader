<template>
  <q-dialog v-model="showEditSubscriptionDialog">
    <q-card class="edit-subscription-card" style="width: 500px; max-width: 90vw;">
      <q-card-section>
        <div class="text-h6">编辑RSS订阅</div>
      </q-card-section>
      
      <q-card-section>
        <q-form @submit="onSubmit" @reset="onReset" class="q-gutter-md">
          <q-input
            filled
            v-model="rssInfoRef.title"
            label="标题"
            placeholder="订阅源标题"
            lazy-rules
            :rules="[val => val && val.length > 0 || '请输入标题']"
          >
            <template v-slot:prepend>
              <q-icon name="title" />
            </template>
          </q-input>
          
          <q-input
            filled
            v-model="rssInfoRef.feedUrl"
            label="订阅URL"
            placeholder="RSS订阅链接"
            lazy-rules
            :rules="[val => val && val.length > 0 || '请输入订阅URL']"
          >
            <template v-slot:prepend>
              <q-icon name="link" />
            </template>
          </q-input>
          
          <q-input
            filled
            v-model="rssInfoRef.htmlUrl"
            label="网站URL（可选）"
            placeholder="原始网站链接"
          >
            <template v-slot:prepend>
              <q-icon name="public" />
            </template>
          </q-input>
          
          <q-select
            filled
            v-model="rssInfoRef.folderName"
            :options="availableFolders"
            label="选择文件夹"
            style="min-width: 200px"
          >
            <template v-slot:prepend>
              <q-icon name="folder" />
            </template>
            <template v-slot:append>
              <q-btn 
                dense 
                flat 
                icon="add_circle_outline" 
                size="xs" 
                @click="onAddNewFolder"
                title="新建文件夹"
              />
            </template>
          </q-select>
        </q-form>
      </q-card-section>
      
      <q-card-actions align="right" class="q-gutter-sm">
        <q-btn label="取消" color="secondary" @click="onCancel" />
        <q-btn label="保存" type="submit" color="primary" :disabled="isLoading" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {reactive, computed, ref, watch} from "vue";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {storeToRefs} from "pinia";
import {useQuasar} from "quasar";

const $q = useQuasar();
const isLoading = ref(false);

const systemDialogStore = useSystemDialogStore();
const rssInfoStore = useRssInfoStore();
const {editRssSubscription} = rssInfoStore;
const {showEditSubscriptionDialog, editSubscriptionOldRssInfo} = storeToRefs(systemDialogStore);
const {toggleEditSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore;

interface RssEditInfo {
  rssId: string;
  title: string;
  feedUrl: string;
  htmlUrl: string;
  folderName: string;
}

const rssInfoRef = reactive<RssEditInfo>({
  rssId: '',
  title: '',
  feedUrl: '',
  htmlUrl: '',
  folderName: '默认'
});

// 获取可用的文件夹列表
const availableFolders = computed(() => {
  return rssInfoStore.rssFolderList.map(folder => folder.folderName);
});

// 监听对话框打开，更新编辑信息
watch(showEditSubscriptionDialog, (newValue) => {
  if (newValue && editSubscriptionOldRssInfo.value) {
    const oldInfo = editSubscriptionOldRssInfo.value;
    rssInfoRef.rssId = oldInfo.rssId;
    rssInfoRef.title = oldInfo.title;
    rssInfoRef.feedUrl = oldInfo.feedUrl;
    rssInfoRef.htmlUrl = oldInfo.htmlUrl || '';
    rssInfoRef.folderName = oldInfo.folderName || '默认';
  }
});

// 添加新文件夹
const onAddNewFolder = () => {
  toggleEditSubscriptionDialog(); // 先关闭当前对话框
  toggleAddFolderDialog(); // 打开添加文件夹对话框
};

// 重置表单
const onReset = () => {
  if (editSubscriptionOldRssInfo.value) {
    const oldInfo = editSubscriptionOldRssInfo.value;
    rssInfoRef.title = oldInfo.title;
    rssInfoRef.feedUrl = oldInfo.feedUrl;
    rssInfoRef.htmlUrl = oldInfo.htmlUrl || '';
    rssInfoRef.folderName = oldInfo.folderName || '默认';
  }
};

// 取消编辑
const onCancel = () => {
  toggleEditSubscriptionDialog();
};

// 提交编辑
const onSubmit = async () => {
  if (!rssInfoRef.title || rssInfoRef.title.trim() === '') {
    $q.notify({
      message: '请输入标题',
      color: 'negative',
      position: 'top'
    });
    return;
  }
  
  if (!rssInfoRef.feedUrl || rssInfoRef.feedUrl.trim() === '') {
    $q.notify({
      message: '请输入订阅URL',
      color: 'negative',
      position: 'top'
    });
    return;
  }
  
  isLoading.value = true;
  
  try {
    // 检查是否有任何变更
    const hasChanges = 
      rssInfoRef.title !== editSubscriptionOldRssInfo.value?.title ||
      rssInfoRef.feedUrl !== editSubscriptionOldRssInfo.value?.feedUrl ||
      rssInfoRef.htmlUrl !== editSubscriptionOldRssInfo.value?.htmlUrl ||
      rssInfoRef.folderName !== editSubscriptionOldRssInfo.value?.folderName;
    
    if (!hasChanges) {
      $q.notify({
        message: '没有任何变更',
        color: 'info',
        position: 'top'
      });
      toggleEditSubscriptionDialog();
      return;
    }
    
    await editRssSubscription({
      ...rssInfoRef,
      oldFolderName: editSubscriptionOldRssInfo.value?.folderName
    });
    
    $q.notify({
      message: '订阅更新成功',
      color: 'positive',
      position: 'top'
    });
    
    toggleEditSubscriptionDialog();
  } catch (error) {
    console.error('更新订阅失败:', error);
    $q.notify({
      message: error instanceof Error ? error.message : '更新订阅失败',
      color: 'negative',
      position: 'top'
    });
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.edit-subscription-card {
  margin: 16px;
}
</style>