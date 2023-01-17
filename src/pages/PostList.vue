<template>
  <q-page class="row items-center justify-evenly">
    这是Rss{{ RssId }}的文章列表
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";

const route = useRoute();
const {RssId} = route.params

</script>
