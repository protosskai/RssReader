<template>
  <q-header elevated class="bg-primary text-white">
    <q-bar class="q-electron-drag" style="height: 45px">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer"/>

        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
          </q-avatar>
          Rss Reader
        </q-toolbar-title>
        <q-btn flat round color="white" icon="add" @click="addSubscription">
          <q-tooltip>
            添加订阅源
          </q-tooltip>
        </q-btn>
        <q-btn flat round color="white" icon="refresh">
          <q-tooltip>
            刷新订阅
          </q-tooltip>
        </q-btn>
        <q-btn flat round color="white" icon="settings" @click="openSettingPage" v-if="settingOrHome=== 'home'">
          <q-tooltip>
            设置
          </q-tooltip>
        </q-btn>
        <q-btn flat round color="white" icon="home" @click="openHomePage" v-if="settingOrHome=== 'setting'">
          <q-tooltip>
            主页
          </q-tooltip>
        </q-btn>
      </q-toolbar>
      <q-btn dense flat icon="minimize" @click="minimize" />
      <q-btn dense flat icon="close" @click="closeApp"/>
    </q-bar>

    <subscribe-dialog/>
  </q-header>
</template>

<script setup lang="ts">
import {inject, provide, ref} from "vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, SUBSCRIBE_DIALOG_REF} from "src/const/InjectionKey";
import SubscribeDialog from "components/SubscribeDialog.vue";
import {switchPage} from "src/common/util";

const toggleLeftDrawer = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC)
const showSubscribeDialog = ref(false);
provide(SUBSCRIBE_DIALOG_REF, showSubscribeDialog);
const settingOrHome = ref('setting') // 控制显示设置按钮还是主页按钮
const addSubscription = () => {
  showSubscribeDialog.value = true
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
const minimize = ()=>{
  if (process.env.MODE === 'electron') {
    window.electronAPI.minimize()
  }
}
</script>
