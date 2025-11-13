<template>
  <q-page class="row items-center justify-evenly" style="width: 100%">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <q-spinner-dots size="50px" color="primary"/>
      <p class="text-subtitle1 q-mt-md">加载中...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <q-card class="error-card">
        <q-card-section>
          <div class="text-h6 text-negative q-mb-md">
            <q-icon name="error" size="24px" class="q-mr-sm"/>
            加载失败
          </div>
          <p class="text-body2">{{ error }}</p>
          <q-btn label="重试" color="primary" @click="retryLoad" class="q-mt-md"/>
        </q-card-section>
      </q-card>
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="PostInfoList.length === 0" class="empty-container">
      <q-icon name="article" size="64px" color="grey-5"/>
      <p class="text-subtitle1 text-grey-6 q-mt-md">暂无文章</p>
    </div>
    
    <!-- 文章列表 -->
    <q-list v-else class="row items-center justify-evenly post-list">
      <post-list-item class="post-list-item" v-for="(item,index) in PostInfoList" :post-info="item" :key="index"
                      :rss-id="rssId"/>
    </q-list>
    
    <!-- 滚动到顶部按钮 -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn
        v-show="showScrollToTop"
        fab
        icon="keyboard_arrow_up"
        color="primary"
        @click="scrollToTop"
        aria-label="滚动到顶部"
      />
    </q-page-sticky>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";
import {onMounted, onUnmounted, Ref, ref} from "vue";
import PostListItem from "src/components/PostListItem.vue";
import {useQuasar} from "quasar";
import {PostIndexItem} from "app/src-electron/storage/common";

const $q = useQuasar()
const route = useRoute();
const rssId: any = route.params.RssId
const PostInfoList: Ref<PostIndexItem[]> = ref([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showScrollToTop = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

const getPostListById = async (rssItemId: string): Promise<PostIndexItem[]> => {
  loading.value = true;
  error.value = null;
  
  try {
    await window.electronAPI.fetchRssIndexList(rssItemId)
    const result = await window.electronAPI.queryPostIndexByRssId(rssItemId)
    return result
  } catch (err: any) {
    error.value = err?.message || '加载文章列表失败，请稍后重试';
    console.error('Failed to load post list:', err);
    return [];
  } finally {
    loading.value = false;
  }
}

const retryLoad = async () => {
  PostInfoList.value = await getPostListById(rssId)
}

const handleScroll = () => {
  if (scrollContainer.value) {
    showScrollToTop.value = scrollContainer.value.scrollTop > 300;
  }
};

const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

onMounted(async () => {
  PostInfoList.value = await getPostListById(rssId)
  
  // 获取滚动容器并添加滚动监听
  scrollContainer.value = document.querySelector('.post-list-container') as HTMLElement;
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll);
  }
});

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style scoped lang="scss">
.post-list-item {
  width: 100%;
}

.post-list {
  width: 100%;
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  width: 100%;
}

.error-card {
  max-width: 400px;
  width: 100%;
}
</style>
