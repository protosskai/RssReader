<template>
  <q-header elevated class="bg-primary text-white">
    <q-bar class="q-electron-drag" style="height: 45px">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer"/>

        <q-toolbar-title>
          {{ SOFT_NAME }}
        </q-toolbar-title>
        <q-btn flat round color="white" icon="add">
          <q-menu>
            <q-list style="width: 100%">
              <q-item clickable v-close-popup @click="addSubscription">
                <q-item-section>添加订阅源</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="addFolder">
                <q-item-section>新建文件夹</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn flat round color="white" icon="refresh">
          <q-tooltip>
            刷新订阅
          </q-tooltip>
        </q-btn>
        <q-btn flat round color="white" icon="home" @click="openHomePage">
          <q-tooltip>
            主页
          </q-tooltip>
        </q-btn>
      </q-toolbar>
      <q-btn dense flat icon="minimize" @click="minimize"/>
      <q-btn dense flat icon="close" @click="closeApp"/>
    </q-bar>

    <subscribe-dialog/>
    <add-folder-dialog/>
  </q-header>
</template>

<script setup lang="ts">
import {inject, provide, ref} from "vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_FUNC} from "src/const/InjectionKey";
import SubscribeDialog from "components/SubscribeDialog.vue";
import {switchPage} from "src/common/util";
import {SOFT_NAME} from "src/const/string";
import AddFolderDialog from "components/AddFolderDialog.vue";
import {useSystemDialogStore} from "stores/systemDialogStore";


const systemDialogStore = useSystemDialogStore()
const {toggleSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore
const toggleLeftDrawer = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC)
const settingOrHome = ref('setting') // 控制显示设置按钮还是主页按钮
const addSubscription = () => {
  toggleSubscriptionDialog()
}
const addFolder = () => {
  toggleAddFolderDialog()
}
const openSettingPage = () => {
  switchPage('Setting')
  settingOrHome.value = 'setting'
}
const openHomePage = () => {
  switchPage('Home')
  settingOrHome.value = 'home'
}
const closeApp = () => {
  if (process.env.MODE === 'electron') {
    window.electronAPI.close()
  }
}
const minimize = () => {
  if (process.env.MODE === 'electron') {
    window.electronAPI.minimize()
  }
}
</script>
