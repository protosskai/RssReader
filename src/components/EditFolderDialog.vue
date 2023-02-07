<template>
  <q-dialog v-model="showEditFolderDialog">
    <q-card class="add-folder-card">
      <q-form
        @submit="onSubmit"
        @reset="onReset"
        class="q-gutter-md"
      >
        <q-input
          filled
          :disable="true"
          v-model="addFolderRef.folderOldNameRef"
          label="原名称"/>
        <q-input
          filled
          v-model="addFolderRef.folderNewNameRef"
          label="新名称"
          lazy-rules
          :rules="[ val => val && val.length > 0 || '请输入文件夹新名称']"
        />
        <div>
          <q-btn label="确认" type="submit" color="primary"/>
          <q-btn label="重置" type="reset" color="primary" flat class="q-ml-sm"/>
        </div>
      </q-form>
    </q-card>

  </q-dialog>
</template>

<script setup lang="ts">
import {reactive} from "vue";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {storeToRefs} from "pinia";
import {useQuasar} from "quasar";
import {watch} from "vue";

const $q = useQuasar()

const systemDialogStore = useSystemDialogStore()
const rssInfoStore = useRssInfoStore()
const {editFolder} = rssInfoStore
const {showEditFolderDialog, editFolderDialogOldFolderName} = storeToRefs(systemDialogStore)
const {toggleEditFolderDialog} = systemDialogStore

const addFolderRef = reactive({
  folderOldNameRef: '',
  folderNewNameRef: ''
})

const clear = () => {
  addFolderRef.folderNewNameRef = '';
}
watch(showEditFolderDialog, () => {
  addFolderRef.folderOldNameRef = editFolderDialogOldFolderName.value
  clear()
})
const onSubmit = async () => {
  toggleEditFolderDialog()
  const res = await editFolder(addFolderRef.folderOldNameRef, addFolderRef.folderNewNameRef)
  if (!res.success) {
    $q.notify({
      message: res.msg,
      icon: 'announcement'
    })
  }
  clear()
}
const onReset = () => {
  clear()
}
</script>

<style scoped lang="scss">
.add-folder-card {
  width: 100%;
  max-width: 500px;
}
</style>
