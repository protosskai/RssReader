<template>
  <q-dialog v-model="showAddFolderDialog">
    <q-card class="add-folder-card">
      <q-form
        @submit="onSubmit"
        @reset="onReset"
        class="q-gutter-md"
      >
        <q-input
          filled
          v-model="addFolderRef.folderNameRef"
          label="文件夹名称"
          lazy-rules
          :rules="[ val => val && val.length > 0 || '请输入文件夹名称']"
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

const $q = useQuasar()

const systemDialogStore = useSystemDialogStore()
const rssInfoStore = useRssInfoStore()
const {addFolder} = rssInfoStore
const {showAddFolderDialog} = storeToRefs(systemDialogStore)
const {toggleAddFolderDialog} = systemDialogStore

const addFolderRef = reactive({
  folderNameRef: ''
})
const clear = () => {
  addFolderRef.folderNameRef = '';

}
const onSubmit = async () => {
  toggleAddFolderDialog()
  const res = await addFolder(addFolderRef.folderNameRef)
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
