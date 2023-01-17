<template>
  <q-item class="post-item">
    <q-card>
      <q-card-section>
        <q-item>
          <q-item-section>
            <q-item-label lines="1" class="text-h6">
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
              {{ postInfo.desc }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
      <q-card-section>
        <q-btn label="阅读" type="submit" color="primary"/>
        <q-btn label="标为已读" type="reset" color="primary" flat class="q-ml-sm"/>
      </q-card-section>

    </q-card>
  </q-item>
</template>

<script setup lang="ts">
import {PostInfoItem} from "src/common/PostInfoItem";

const props = defineProps<{
  postInfo: PostInfoItem
}>()
</script>

<style scoped lang="scss">
.post-item {
  width: 75%;
}
</style>
