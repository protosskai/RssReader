<template>
  <q-dialog v-model="showMoveFolderDialog">
    <q-card class="move-folder-card">
      <q-card-section>
        <div class="text-h6 q-mb-md">移动文件夹</div>
        <div class="q-mb-md">
          <span>当前文件夹：</span>
          <span class="font-bold">{{ currentFolderName }}</span>
        </div>
        <div class="q-mb-md">
          <span>选择目标位置：</span>
        </div>
        
        <!-- 根目录选项 -->
        <q-item
          clickable
          v-ripple
          class="target-folder-item q-mb-sm"
          :class="{ 'target-folder-selected': selectedTargetFolder === '' }"
          @click="selectedTargetFolder = ''"
        >
          <q-item-section avatar>
            <q-icon name="folder" />
          </q-item-section>
          <q-item-section>
            <q-item-label>根目录</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-radio
              v-model="selectedTargetFolder"
              val=""
              checked-icon="radio_button_checked"
              unchecked-icon="radio_button_unchecked"
            />
          </q-item-section>
        </q-item>
        
        <!-- 文件夹选择列表 -->
        <div class="folder-select-list">
          <div
            v-for="folder in availableFolders"
            :key="folder.folderName"
          >
            <q-item
              clickable
              v-ripple
              class="target-folder-item q-mb-sm"
              :class="{ 'target-folder-selected': selectedTargetFolder === folder.folderName }"
              @click="selectedTargetFolder = folder.folderName"
            >
              <q-item-section avatar>
                <q-icon name="folder" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ folder.folderName }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-radio
                  v-model="selectedTargetFolder"
                  :val="folder.folderName"
                  checked-icon="radio_button_checked"
                  unchecked-icon="radio_button_unchecked"
                />
              </q-item-section>
            </q-item>
          </div>
        </div>
      </q-card-section>
      
      <q-card-actions align="right">
        <q-btn label="取消" @click="closeDialog" />
        <q-btn label="确认" color="primary" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from "vue";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {storeToRefs} from "pinia";
import {useQuasar} from "quasar";

const $q = useQuasar();
const systemDialogStore = useSystemDialogStore();
const rssInfoStore = useRssInfoStore();

// 从store获取状态和方法
const {showMoveFolderDialog, currentFolderName} = storeToRefs(systemDialogStore);
const {toggleMoveFolderDialog} = systemDialogStore;
const {rssFolderList, moveFolder} = rssInfoStore;

// 选中的目标文件夹
const selectedTargetFolder = ref<string>('');

// 可用的目标文件夹（排除当前文件夹及其子文件夹）
const availableFolders = computed(() => {
  const folders: any[] = [];
  
  const collectAvailableFolders = (folderList: any[], excludeFolderName: string, isChild: boolean = false) => {
    for (const folder of folderList) {
      // 排除当前文件夹
      if (folder.folderName !== excludeFolderName) {
        // 如果不是当前文件夹的子文件夹，添加到可用列表
        if (!isChild) {
          folders.push(folder);
        }
        
        // 递归检查子文件夹
        if (folder.children && folder.children.length > 0) {
          collectAvailableFolders(
            folder.children, 
            excludeFolderName, 
            isChild || folder.folderName === excludeFolderName
          );
        }
      }
    }
  };
  
  collectAvailableFolders(rssFolderList.value, currentFolderName.value);
  return folders;
});

// 关闭对话框
const closeDialog = () => {
  toggleMoveFolderDialog();
  selectedTargetFolder.value = '';
};

// 提交移动操作
const onSubmit = async () => {
  try {
    const targetFolder = selectedTargetFolder.value || undefined;
    const result = await moveFolder(currentFolderName.value, targetFolder);
    
    if (result.success) {
      $q.notify({
        message: '文件夹移动成功',
        color: 'positive',
        position: 'top'
      });
    } else {
      $q.notify({
        message: result.msg || '移动失败',
        color: 'negative',
        position: 'top'
      });
    }
    
    closeDialog();
  } catch (error) {
    console.error('移动文件夹失败:', error);
    $q.notify({
      message: '移动文件夹时发生错误',
      color: 'negative',
      position: 'top'
    });
    closeDialog();
  }
};

// 监听对话框显示，重置选择
onMounted(() => {
  const unwatch = showMoveFolderDialog.value;
  return unwatch;
});
</script>

<style scoped lang="scss">
.move-folder-card {
  width: 100%;
  max-width: 400px;
}

.target-folder-item {
  transition: background-color 0.2s;
  border-radius: 8px;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.target-folder-selected {
  background-color: rgba(0, 0, 0, 0.08);
}

.folder-select-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}
</style>