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
import {PostIndexItem} from "src-electron/storage/common";
import {useQuasar} from "quasar";

const props = defineProps<{
  rssId: string,
  postInfo: PostIndexItem
}>()

const $q = useQuasar();

// 实现一个能处理Unicode字符的base64编码函数
const safeBtoa = (str: string): string => {
  try {
    // 对于包含Unicode字符的字符串，先转换为UTF-8
    return btoa(unescape(encodeURIComponent(str)));
  } catch (error) {
    console.warn('[PostListItem.vue] SafeBtoa encoding failed, using fallback:', error);
    // 失败时返回一个简单的哈希值
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
};

const openContentPage = () => {
  // 使用文章的guid作为postId
  let postId = props.postInfo.guid;
  
  // 更健壮的ID处理逻辑
  console.log('[PostListItem.vue] Checking postInfo object:', props.postInfo);
  
  // 优先检查guid字段的有效性
  if (!postId || typeof postId !== 'string' || postId === 'undefined' || postId === 'null' || postId.trim() === '') {
    console.log('[PostListItem.vue] guid is empty or invalid, trying other fields');
    
    // 检查PostIndexItem是否有title属性作为备选
    if (props.postInfo.title && typeof props.postInfo.title === 'string') {
      console.log('[PostListItem.vue] Using title as fallback ID source');
      // 使用安全的base64编码处理可能包含中文的标题
      postId = `title_${safeBtoa(props.postInfo.title.substring(0, 30)).substring(0, 20)}`;
    } else {
      // 生成完全随机的临时ID
      console.log('[PostListItem.vue] Generating random temporary ID');
      postId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
  }
  
  console.log('[PostListItem.vue] 导航到Content页面，参数:', { RssId: props.rssId, PostId: postId });
  
  try {
    switchPage('Content', {
      RssId: props.rssId,
      PostId: postId
    });
  } catch (error) {
    console.error('[PostListItem.vue] Error navigating to content page:', error);
    // 显示错误提示给用户
    $q.notify({
      type: 'negative',
      message: '打开文章失败，请重试',
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
