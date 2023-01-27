<template>
  <q-page class="content-page">
    <q-item style="width: 100%;">
      <q-item-section>
        <q-item-label v-if="curContentInfo.rssSource"
                      lines="1"
                      class="text-h6 text-primary url"
                      style="margin-bottom: 5px"
                      @click="openUrl(curContentInfo.rssSource.htmlUrl)">
          {{ curContentInfo.rssSource.name }}
        </q-item-label>
        <q-separator/>

        <q-item-label lines="2" class="text-h5 url" style="margin-top: 15px" @click="openUrl(curContentInfo.link)">
          {{ curContentInfo.title }}
        </q-item-label>

        <q-item-label lines="1" class="text-h6 text-weight-light">
          {{ curContentInfo.author }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <div v-if="curContentInfo" v-html="curContentInfo.content" class="content-area">
    </div>
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
const curContentInfo: Ref<ContentInfo> = ref({
  title: '',
  content: '',
  author: '',
  updateTime: '',
  link: ''
});
const getContentById = async (rssId: number, postId: number): Promise<ContentInfo> => {
  $q.loading.show({
    message: '加载中...'
  })
  const result = await window.electronAPI.getPostContent(rssId, postId)
  $q.loading.hide()
  return result
}
const fixContentStyle = (htmlStr: string): string => {
  let result = htmlStr.replace(/<img/g, '<img style="max-width:80%" ')
  result = result.replace(/<h1/g, '<h1 style="font-size:32px" ')
  result = result.replace(/<h2/g, '<h2 style="font-size:24px" ')
  result = result.replace(/<h3/g, '<h3 style="font-size:18px" ')
  result = result.replace(/<h4/g, '<h4 style="font-size:16px" ')
  result = result.replace(/<h5/g, '<h5 style="font-size:13px" ')
  result = result.replace(/<h6/g, '<h6 style="font-size:10px" ')
  return result
}
onMounted(async () => {
  const result = await getContentById(Number(RssId), Number(PostId))
  result.content = fixContentStyle(result.content)
  curContentInfo.value = result
})

const openUrl = (url: string) => {
  window.electronAPI.openLink(url)
}
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

.url {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
