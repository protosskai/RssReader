<template>
  <q-dialog v-model="showDialog">
    <q-card class="subscribe-card">
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
        <div>
          <q-btn label="确认" type="submit" color="primary"/>
          <q-btn label="重置" type="reset" color="primary" flat class="q-ml-sm"/>
        </div>
      </q-form>
    </q-card>

  </q-dialog>
</template>

<script setup lang="ts">
import {inject, reactive} from "vue";
import {SUBSCRIBE_DIALOG_REF} from "src/const/InjectionKey";

const showDialog = inject(SUBSCRIBE_DIALOG_REF)
const subscribeRef = reactive({
  urlInputRef: '',
  nameInputRef: ''
})
const clear = () => {
  subscribeRef.urlInputRef = '';
  subscribeRef.nameInputRef = '';
}
const onSubmit = () => {
  console.log(subscribeRef.urlInputRef)
  console.log(subscribeRef.nameInputRef)
  showDialog!.value = false
  clear()

}
const onReset = () => {
  clear()
}
</script>

<style scoped lang="scss">
.subscribe-card {
  width: 100%;
  max-width: 500px;
}
</style>
