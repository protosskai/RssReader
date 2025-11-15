<template>
  <q-dialog v-model="showAddSubscriptionDialog">
    <q-card class="add-subscription-card" style="width: 500px; max-width: 90vw;">
      <q-card-section>
        <div class="text-h6">添加RSS订阅</div>
      </q-card-section>
      
      <q-card-section>
        <q-form @submit="onSubmit" @reset="onReset" class="q-gutter-md">
          <q-input
            filled
            v-model="rssInfoRef.feedUrl"
            label="订阅URL"
            placeholder="请输入RSS订阅链接"
            lazy-rules
            :rules="[val => val && val.length > 0 || '请输入订阅URL']"
          >
            <template v-slot:prepend>
              <q-icon name="link" />
            </template>
          </q-input>
          
          <q-input
            filled
            v-model="rssInfoRef.title"
            label="标题（可选）"
            placeholder="如果留空，将自动从RSS获取"
          >
            <template v-slot:prepend>
              <q-icon name="title" />
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
        <q-btn label="添加" type="submit" color="primary" :disabled="isLoading" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {reactive, computed, ref} from "vue";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {storeToRefs} from "pinia";
import {useQuasar} from "quasar";
import {RssInfoNew} from "src/common/RssInfoItem";

const $q = useQuasar();
const isLoading = ref(false);

const systemDialogStore = useSystemDialogStore();
const rssInfoStore = useRssInfoStore();
const {addRssSubscription} = rssInfoStore;
const {showAddSubscriptionDialog} = storeToRefs(systemDialogStore);
const {toggleAddSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore;

const rssInfoRef = reactive<RssInfoNew>({
  feedUrl: '',
  title: '',
  folderName: '默认'
});

// 获取可用的文件夹列表
const availableFolders = computed(() => {
  return rssInfoStore.rssFolderList.map(folder => folder.folderName);
});

// 添加新文件夹
const onAddNewFolder = () => {
  toggleAddSubscriptionDialog(); // 先关闭当前对话框
  toggleAddFolderDialog(); // 打开添加文件夹对话框
};

// 重置表单
const onReset = () => {
  rssInfoRef.feedUrl = '';
  rssInfoRef.title = '';
  rssInfoRef.folderName = '默认';
};

// 取消添加
const onCancel = () => {
  onReset();
  toggleAddSubscriptionDialog();
};

// 提交订阅
const onSubmit = async () => {
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
    await addRssSubscription(rssInfoRef);
    $q.notify({
      message: '订阅添加成功',
      color: 'positive',
      position: 'top'
    });
    onReset();
    toggleAddSubscriptionDialog();
  } catch (error) {
    console.error('添加订阅失败:', error);
    $q.notify({
      message: error instanceof Error ? error.message : '添加订阅失败，请检查URL是否正确',
      color: 'negative',
      position: 'top'
    });
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.add-subscription-card {
  margin: 16px;
}
</style>