<template>
  <q-item class="post-item">
    <q-card style="width: 100%">
      <q-card-section>
        <q-item>
          <q-item-section>
            <q-item-label lines="1" class="text-h6">
              <q-icon name="fiber_manual_record" color="red-6" class="unread-icon text-subtitle1"
                      v-if="!postInfo.read"/>
              {{ postInfo.title }}
            </q-item-label>
            <q-item-label lines="1" class="text-subtitle2" v-if="postInfo.author">
              {{ postInfo.author }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>
              {{ postInfo.updateTime }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>

      <q-separator/>

      <q-card-section>
        <q-item>
          <q-item-section>
            <q-item-label lines="3" class="text-body1">
              {{ extractTextFromHtml(postInfo.desc) }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
      <q-card-section>
        <q-btn label="阅读" color="primary" @click="openContentPage"/>
        <q-btn label="收藏" color="primary" flat class="q-ml-sm"/>
        <q-btn label="标为已读" color="primary" flat class="q-ml-sm"/>
      </q-card-section>

    </q-card>
  </q-item>
</template>

<script setup lang="ts">
import {switchPage, extractTextFromHtml} from "src/common/util";
import {PostIndexItem} from "app/src-electron/storage/common";

const props = defineProps<{
  rssId: string,
  postInfo: PostIndexItem
}>()
const openContentPage = () => {
  switchPage('Content', {
    RssId: props.rssId,
    PostId: props.postInfo.guid
  })
}

</script>

<style scoped lang="scss">
.post-item {
  width: 100%;
}

.unread-icon {
  position: absolute;
  left: -10px;
  top: 12px
}
</style>
