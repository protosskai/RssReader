<template>
  <q-page class="row items-center justify-evenly" style="width: 100%">
    <q-list class="row items-center justify-evenly post-list">
      <post-list-item class="post-list-item" v-for="(item,index) in PostInfoList" :post-info="item" :key="index"
                      :rss-id="rssId"/>
    </q-list>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";
import {PostInfoItem} from "src/common/PostInfoItem";
import {onMounted, Ref, ref} from "vue";
import PostListItem from "src/components/PostListItem.vue";
import {useQuasar} from "quasar";

const route = useRoute();
const $q = useQuasar()
const {RssId} = route.params
const rssId = Number((RssId as string))
const PostInfoList: Ref<PostInfoItem[]> = ref([]);
const getPostListById = async (rssItemId: number): Promise<PostInfoItem[]> => {
  $q.loading.show({
    message: '加载中...'
  })
  const result = await window.electronAPI.getPostListInfo(rssItemId)
  $q.loading.hide()
  return result
}
onMounted(async () => {
  PostInfoList.value = await getPostListById(rssId)
})
</script>

<style scoped lang="scss">
.post-list-item {
  width: 100%;
}

.post-list {
  width: 100%;
}
</style>
