<template>
  <q-page class="column items-start" style="width: 100%; padding: 16px;">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <q-spinner-dots size="50px" color="primary"/>
      <p class="text-subtitle1 q-mt-md">加载中...</p>
      <p class="text-caption text-grey-6 q-mt-sm">正在同步RSS源，请稍候（最多60秒）</p>
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
          <div class="q-mt-md">
            <q-btn label="重试" color="primary" @click="retryLoad" class="q-mr-sm"/>
            <q-btn label="返回" color="grey-7" flat @click="goBack"/>
          </div>
          <div class="q-mt-md text-caption text-grey-6">
            <p>💡 如果问题持续，请尝试：</p>
            <ul class="q-pl-md">
              <li>检查网络连接</li>
              <li>稍后重试（RSS源可能暂时不可用）</li>
              <li>在开发者工具中查看详细错误信息</li>
            </ul>
          </div>
        </q-card-section>
      </q-card>
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="PostInfoList.length === 0" class="empty-container">
      <q-icon name="article" size="64px" color="grey-5"/>
      <p class="text-subtitle1 text-grey-6 q-mt-md">暂无文章</p>
      <p class="text-caption text-grey-6 q-mt-sm">
        此RSS源暂无文章数据。<br>
        可能原因：初次订阅、同步失败或RSS源暂时无更新。
      </p>
      <q-btn label="尝试刷新" color="primary" @click="retryLoad" class="q-mt-md"/>
    </div>
    
    <!-- 文章列表容器 -->
    <div v-else class="post-list-container" style="width: 100%;">
      <q-list separator class="post-list">
        <post-list-item v-for="(item,index) in PostInfoList" :post-info="item" :key="index" :rss-id="rssId"/>
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
    </div>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute, useRouter} from "vue-router";
import {onMounted, onUnmounted, Ref, ref} from "vue";
import PostListItem from "src/components/PostListItem.vue";
import {useQuasar} from "quasar";
import {PostIndexItem} from "app/src-electron/storage/common";

const $q = useQuasar()
const route = useRoute();
const router = useRouter();
const rssId: any = route.params.RssId

const goBack = () => {
  router.push('/');
};
const PostInfoList: Ref<PostIndexItem[]> = ref([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showScrollToTop = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

const getPostListById = async (rssItemId: string): Promise<PostIndexItem[]> => {
  console.log('[PostList.vue] getPostListById called with rssItemId:', rssItemId);
  loading.value = true;
  error.value = null;

  try {
    console.log('[PostList.vue] Step 1: Syncing RSS feed (fetchRssIndexList)...');
    console.log('[PostList.vue] This may take a while if the RSS source is slow...');

    // 添加60秒超时控制
    const syncTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('同步RSS源超时，请检查网络连接或RSS源是否可用')), 60000);
    });

    const syncPromise = window.electronAPI.fetchRssIndexList(rssItemId);
    const syncResult = await Promise.race([syncPromise, syncTimeout]);

    console.log('[PostList.vue] fetchRssIndexList result:', syncResult);
    console.log('[PostList.vue] Step 2: Querying article list (queryPostIndexByRssId)...');

    // 查询文章列表
    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('查询文章列表超时')), 30000);
    });

    const queryPromise = window.electronAPI.queryPostIndexByRssId(rssItemId);
    const result = await Promise.race([queryPromise, queryTimeout]);

    console.log('[PostList.vue] queryPostIndexByRssId result:', result);
    console.log('[PostList.vue] Article count:', result.length);

    // 如果没有文章，显示提示
    if (result.length === 0) {
      console.log('[PostList.vue] No articles found, this is normal for a new RSS source');
      console.log('[PostList.vue] Try refreshing the RSS source later');
    }

    return result;
  } catch (err: any) {
    console.error('[PostList.vue] Error loading post list:', err);
    const errorMessage = err?.message || '加载文章列表失败，请稍后重试';
    error.value = errorMessage;
    console.error('[PostList.vue] Full error:', err);
    return [];
  } finally {
    loading.value = false;
    console.log('[PostList.vue] Loading finished, isLoading:', loading.value);
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
  console.log('[PostList.vue] Component mounted, rssId:', rssId);
  PostInfoList.value = await getPostListById(rssId)

  // 获取滚动容器并添加滚动监听
  scrollContainer.value = document.querySelector('.post-list-container') as HTMLElement;
  console.log('[PostList.vue] Scroll container found:', scrollContainer.value);
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
.post-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.post-list-item {
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

.post-list-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
