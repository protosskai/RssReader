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
      <q-card-section class="action-buttons">
        <q-btn label="阅读" color="primary" @click="openContentPage" unelevated/>
        <q-btn 
          :label="postInfo.read ? '标为未读' : '标为已读'" 
          color="primary" 
          flat 
          class="q-ml-sm"
          @click.stop="toggleReadStatus"
        />
        <q-btn 
          icon="open_in_new" 
          color="primary" 
          flat 
          class="q-ml-sm"
          @click.stop="openInBrowser"
        >
          <q-tooltip>在浏览器中打开</q-tooltip>
        </q-btn>
      </q-card-section>

    </q-card>
  </q-item>
</template>

<script setup lang="ts">
import {switchPage, extractTextFromHtml} from "src/common/util";
import {PostIndexItem} from "src-electron/storage/common";
import {useQuasar} from "quasar";

const props = defineProps<{
  rssId: string,
  postInfo: PostIndexItem
}>()

const $q = useQuasar();

const toggleReadStatus = () => {
  // TODO: 实现标记已读/未读功能
  $q.notify({
    message: props.postInfo.read ? '已标记为未读' : '已标记为已读',
    color: 'positive',
    position: 'top',
    timeout: 1000
  });
};

const openInBrowser = () => {
  if (props.postInfo.link) {
    window.electronAPI.openLink(props.postInfo.link);
  }
};

const openContentPage = () => {
  try {
    // 直接使用后端返回的guid作为文章ID
    const postId = props.postInfo.guid || props.postInfo.link;
    
    if (!postId) {
      $q.notify({
        type: 'negative',
        message: '无法获取文章标识',
        position: 'top'
      });
      return;
    }

    switchPage('Content', {
      RssId: props.rssId,
      PostId: postId
    });
  } catch (error) {
    console.error('[PostListItem.vue] Error navigating to content page:', error);
    $q.notify({
      type: 'negative',
      message: '打开文章失败',
      position: 'top'
    });
  }
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
