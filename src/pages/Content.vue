<template>
  <q-page class="content-page">
    <q-item v-if="curContentInfo" v-html="curContentInfo.content" class="content-area">
    </q-item>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";
import {ContentInfo} from "src/common/ContentInfo";
import {onMounted, ref, Ref} from "vue";
import {useQuasar} from "quasar";

const route = useRoute();
const $q = useQuasar()
const {RssId, PostId} = route.params
const curContentInfo: Ref<ContentInfo | null> = ref(null);
const getContentById = async (rssId: number, postId: number): Promise<ContentInfo> => {
  $q.loading.show({
    message: '加载中...'
  })
  const result = await window.electronAPI.getPostContent(rssId, postId)
  $q.loading.hide()
  return result
}
const fixContentImgSize = (htmlStr: string): string => {
  return htmlStr.replace(/<img/g, '<img style="max-width:80%" ')
}
onMounted(async () => {
  const result = await getContentById(Number(RssId), Number(PostId))
  result.content = fixContentImgSize(result.content)
  curContentInfo.value = result
})


</script>

<style scoped lang="scss">
.content-page {
  padding-left: 25px;
  padding-right: 25px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

.content-area {
  @import "src/css/typo.scss";
  width: 100%;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;

  figure, img {
    max-width: 50%;
    max-height: 50%;
  }
}
</style>
