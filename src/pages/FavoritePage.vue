<template>
  <q-page class="favorite-page">
    <q-toolbar class="bg-primary text-white">
      <q-toolbar-title class="text-center">我的收藏</q-toolbar-title>
    </q-toolbar>

    <div class="favorite-container">
      <!-- 加载状态 -->
      <q-skeleton v-if="loading" type="QCard" class="favorite-skeleton" />
      <q-skeleton v-if="loading" type="QCard" class="favorite-skeleton" />
      <q-skeleton v-if="loading" type="QCard" class="favorite-skeleton" />

      <!-- 空状态 -->
      <div v-else-if="favoritePosts.length === 0" class="empty-state">
        <q-icon name="star_border" size="80px" color="grey" />
        <h3 class="text-h3 empty-title">暂无收藏</h3>
        <p class="empty-desc">收藏的文章会显示在这里</p>
        <q-btn 
          color="primary" 
          label="浏览文章" 
          unelevated 
          class="mt-4"
          @click="goToHome"
        />
      </div>

      <!-- 收藏文章列表 -->
      <div v-else class="favorite-list">
        <q-card 
          v-for="post in favoritePosts" 
          :key="post.guid"
          class="favorite-card"
          @click="openContentPage(post)"
        >
          <q-card-section>
            <div class="favorite-card-header">
              <q-item-section>
                <q-item-label lines="2" class="favorite-card-title">
                  {{ post.title }}
                </q-item-label>
                <q-item-label lines="1" class="favorite-card-meta">
                  {{ post.author }} · {{ formatRelativeTime(post.updateTime) }}
                </q-item-label>
              </q-item-section>
              <q-btn
                icon="star"
                color="amber"
                size="sm"
                class="favorite-icon"
                @click.stop="unfavoritePost(post)"
                title="取消收藏"
              />
            </div>
            
            <q-separator class="my-3" />
            
            <q-item-label lines="3" class="favorite-card-desc">
              {{ extractTextFromHtml(post.desc) }}
            </q-item-label>
          </q-card-section>
          
          <q-card-actions>
            <q-btn 
              flat 
              label="阅读全文" 
              color="primary"
            />
            <q-btn 
              flat 
              icon="open_in_new" 
              color="primary"
              @click.stop="openInBrowser(post)"
            >
              <q-tooltip>在浏览器中打开</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="error-state">
        <q-icon name="error" size="60px" color="negative" />
        <h3 class="text-h3 error-title">加载失败</h3>
        <p class="error-desc">{{ error }}</p>
        <q-btn 
          color="primary" 
          label="重试" 
          unelevated 
          class="mt-4"
          @click="loadFavoritePosts"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import {ref, onMounted} from "vue";
import {useQuasar} from "quasar";
import {switchPage, extractTextFromHtml} from "src/common/util";
import {useFavoriteStore} from "src/stores/favoriteStore";
import type {PostIndexItem} from "app/src-electron/storage/common";

const $q = useQuasar();
const favoriteStore = useFavoriteStore();

const favoritePosts = ref<PostIndexItem[]>([]);
const loading = ref(true);
const error = ref('');

// 加载收藏文章
const loadFavoritePosts = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const posts = await favoriteStore.getFavoritePosts();
    // 按更新时间倒序排序
    favoritePosts.value = posts.sort((a, b) => {
      return new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime();
    });
  } catch (err) {
    console.error('加载收藏文章失败:', err);
    error.value = '无法加载收藏文章，请稍后重试';
  } finally {
    loading.value = false;
  }
};

// 取消收藏
const unfavoritePost = async (post: PostIndexItem) => {
  try {
    // 先在UI上移除，提升用户体验
    const index = favoritePosts.value.findIndex(p => p.guid === post.guid);
    if (index !== -1) {
      favoritePosts.value.splice(index, 1);
    }
    
    // 设置isFavorite为false并调用toggleFavorite
    const postToToggle = { ...post, isFavorite: false };
    await favoriteStore.toggleFavorite(postToToggle);
    
    $q.notify({
      type: 'info',
      message: '已取消收藏',
      position: 'top-right',
      timeout: 1200
    });
  } catch (err) {
    console.error('取消收藏失败:', err);
    // 如果失败，重新加载列表
    await loadFavoritePosts();
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top-right'
    });
  }
};

// 打开文章内容页面
const openContentPage = (post: PostIndexItem) => {
  try {
    // 自动标记为已读
    if (!post.read) {
      post.read = true;
    }
    
    switchPage('Content', {
      RssId: post.rssId,
      PostId: post.guid
    });
  } catch (error) {
    console.error('打开文章失败:', error);
    $q.notify({
      type: 'negative',
      message: '打开文章失败',
      position: 'top-right'
    });
  }
};

// 在浏览器中打开
const openInBrowser = (post: PostIndexItem) => {
  if (post.link) {
    window.electronAPI.openLink(post.link);
    
    // 自动标记为已读
    if (!post.read) {
      post.read = true;
    }
  } else {
    $q.notify({
      type: 'negative',
      message: '文章没有链接可打开',
      position: 'top-right'
    });
  }
};

// 格式化相对时间
const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '未知时间';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`;
    } else if (diffInDays < 7) {
      return `${diffInDays}天前`;
    } else {
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    }
  } catch (error) {
    return '未知时间';
  }
};

// 跳转到首页
const goToHome = () => {
  switchPage('Home');
};

// 组件挂载时加载数据
onMounted(() => {
  loadFavoritePosts();
});
</script>

<style scoped lang="scss">
.favorite-page {
  height: 100%;
  background-color: rgba(0, 0, 0, 0.02);
}

.favorite-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.favorite-skeleton {
  margin-bottom: 16px;
  opacity: 0.7;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: #777;
}

.empty-title {
  margin-top: 16px;
  margin-bottom: 8px;
}

.empty-desc {
  margin-bottom: 16px;
  font-size: 16px;
}

.favorite-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.favorite-card {
  transition: all 0.3s ease;
  border-radius: 8px;
  cursor: pointer;
}

.favorite-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
}

.favorite-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.favorite-card-title {
  font-weight: 600;
  font-size: 16px;
  transition: color 0.2s ease;
}

.favorite-card-title:hover {
  color: #1976d2;
}

.favorite-card-meta {
  color: #777;
  font-size: 14px;
  margin-top: 4px;
}

.favorite-card-desc {
  color: #666;
  line-height: 1.6;
  font-size: 14px;
}

.favorite-icon {
  opacity: 0.8;
  transition: all 0.2s ease;
}

.favorite-icon:hover {
  opacity: 1;
  transform: scale(1.1);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  color: #777;
}

.error-title {
  margin-top: 16px;
  margin-bottom: 8px;
}

.error-desc {
  margin-bottom: 16px;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .favorite-container {
    padding: 12px;
  }
  
  .favorite-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .favorite-card {
    margin-bottom: 8px;
  }
  
  .favorite-card-title {
    font-size: 15px;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .favorite-page {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .favorite-card-title {
    color: #e0e0e0;
  }
  
  .favorite-card-title:hover {
    color: #90caf9;
  }
  
  .favorite-card-meta {
    color: #bbb;
  }
  
  .favorite-card-desc {
    color: #aaa;
  }
  
  .empty-state, .error-state {
    color: #bbb;
  }
}
</style>