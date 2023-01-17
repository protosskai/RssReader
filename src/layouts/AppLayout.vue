<template>
  <q-layout view="hHh lpR fFf">
    <app-header :toggle-left-drawer="toggleLeftDrawer"/>

    <app-drawer :left-drawer-open="leftDrawerOpen"/>

    <q-page-container>
      <router-view :key="route.fullPath"/>
    </q-page-container>

  </q-layout>
</template>

<script setup lang="ts">
import {provide, ref} from 'vue'
import AppHeader from "layouts/AppHeader.vue";
import AppDrawer from "layouts/AppDrawer.vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, TOGGLE_LAYOUT_LEFT_DRAWER_REF} from "src/const/InjectionKey";
import {useRoute} from "vue-router";

const route = useRoute();
const leftDrawerOpen = ref(false)
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
provide(TOGGLE_LAYOUT_LEFT_DRAWER_REF, leftDrawerOpen);
provide(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, toggleLeftDrawer);

</script>
