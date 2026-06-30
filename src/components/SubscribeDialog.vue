<template>
  <q-dialog v-model="showAddSubscriptionDialog">
    <q-card class="add-folder-card">
      <q-form
        @submit="onSubmit"
        @reset="onReset"
        class="q-gutter-md"
      >
        <q-input
          filled
          v-model="subscribeRef.urlInputRef"
          label="订阅url"
          hint="你要订阅的rss的链接"
          lazy-rules
          :rules="[ val => val && val.length > 0 || '请输入订阅url']"
        />

        <q-input
          filled
          v-model="subscribeRef.nameInputRef"
          label="名称(可空)"
          hint="别名, 置空则用默认名称"
          lazy-rules
        />
        <q-select
          filled
          v-model="subscribeRef.folderInputRef"
          :options="folderNameList"
          label="文件夹(可空)"
          hint="订阅源存放的文件夹，置空则使用默认文件夹"
          lazy-rules
        />
        <div>
          <q-btn label="确认" type="submit" color="primary" :loading="isSubmitting"/>
          <q-btn label="重置" type="reset" color="primary" flat class="q-ml-sm"/>
        </div>
      </q-form>
    </q-card>

  </q-dialog>
</template>

<script setup lang="ts">
import {reactive, ref} from "vue";
import {useRssInfoStore} from "stores/rssInfoStore";
import {storeToRefs} from "pinia";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useQuasar} from "quasar";

const $q = useQuasar()
const isSubmitting = ref(false)

const systemDialogStore = useSystemDialogStore()
const {showAddSubscriptionDialog} = storeToRefs(systemDialogStore)
const {toggleSubscriptionDialog} = systemDialogStore
const rssInfoStore = useRssInfoStore()
const {folderNameList} = storeToRefs(rssInfoStore)
const {addRssSubscription} = rssInfoStore
const subscribeRef = reactive({
  urlInputRef: '',
  nameInputRef: '',
  folderInputRef: ''
})
const clear = () => {
  subscribeRef.urlInputRef = '';
  subscribeRef.nameInputRef = '';
  subscribeRef.folderInputRef = '';
}
const onSubmit = async () => {
  if (!subscribeRef.urlInputRef.trim()) {
    $q.notify({
      message: '请输入订阅URL',
      color: 'warning',
      position: 'top'
    });
    return;
  }
  
  isSubmitting.value = true;
  try {
    await addRssSubscription(subscribeRef.urlInputRef, subscribeRef.nameInputRef, subscribeRef.folderInputRef)
    toggleSubscriptionDialog()
    $q.notify({
      type: 'positive',
      message: '订阅添加成功',
      position: 'top'
    });
    clear()
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: '添加订阅失败，请检查URL是否正确',
      position: 'top'
    });
  } finally {
    isSubmitting.value = false;
  }
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
