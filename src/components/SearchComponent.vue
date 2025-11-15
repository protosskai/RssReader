<template>
  <div class="search-container">
    <div class="search-input-wrapper">
      <input
        v-model="searchQuery"
        @input="handleInput"
        @keyup.enter="handleSearch"
        type="text"
        placeholder="搜索文章标题、作者或内容..."
        class="search-input"
        :disabled="isSearching"
        autocomplete="off"
        spellcheck="false"
      />
      <button
        @click="handleSearch"
        class="search-button"
        :disabled="isSearching || !searchQuery.trim()"
      >
        <span v-if="isSearching" class="searching-spinner">
          <span class="spinner-dot"></span>
          <span class="spinner-dot"></span>
          <span class="spinner-dot"></span>
        </span>
        <span v-else>搜索</span>
      </button>
      <button
        v-if="searchQuery"
        @click="clearSearch"
        class="clear-button"
        title="清空"
        aria-label="清空搜索框"
      >
        ×
      </button>
    </div>

    <!-- 热门搜索标签 -->
    <div v-if="showHistory && !hasHistory && !isQueryEmpty" class="hot-tags">
      <div class="tags-header">热门搜索</div>
      <div class="tags-container">
        <button
          v-for="tag in hotTags"
          :key="tag"
          class="hot-tag"
          @click="searchWithTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 搜索历史 -->
    <div v-if="showHistory && hasHistory" class="search-history">
      <div class="history-header">
        <span>搜索历史</span>
        <button @click="confirmClearHistory" class="clear-history-button">清空</button>
      </div>
      <div class="history-list">
        <div
          v-for="historyItem in searchHistory"
          :key="historyItem"
          class="history-item"
          @click="searchFromHistory(historyItem)"
        >
          <span class="history-icon">🔍</span>
          <span class="history-text">{{ historyItem }}</span>
          <button
            @click.stop="removeFromHistory(historyItem)"
            class="remove-history-button"
            title="移除"
            aria-label="移除搜索历史"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="showResults" class="search-results">
      <div v-if="isSearching" class="search-status">
        <div class="loading-spinner"></div>
        <span>正在搜索相关内容...</span>
      </div>
      <div v-else-if="searchError" class="search-error">
        <div class="error-icon">⚠️</div>
        <p>{{ searchError }}</p>
        <button class="retry-button" @click="handleSearch">重试</button>
      </div>
      <div v-else-if="hasResults" class="search-results-list">
        <div class="results-header">
          <span>找到 {{ searchResults.length }} 条结果</span>
        </div>
        <div
          v-for="post in searchResults"
          :key="post.guid"
          class="search-result-item"
          @click="handleResultClick(post)"
        >
          <div class="result-content">
            <div class="result-title">{{ post.title }}</div>
            <div class="result-meta">
              <span class="result-source">{{ post.source || post.author || '未知来源' }}</span>
              <span class="result-time">{{ formatRelativeTime(post.updateTime) }}</span>
            </div>
            <div v-if="post.desc" class="result-desc">{{ post.desc }}</div>
          </div>
          <div class="result-actions">
            <button
              @click.stop="handleFavoriteToggle(post)"
              class="favorite-button"
              :class="{ active: post.isFavorite }"
              title="收藏"
              aria-label="收藏文章"
            >
              <i class="favorite-icon">{{ post.isFavorite ? '★' : '☆' }}</i>
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="!isQueryEmpty" class="search-empty">
        <div class="empty-icon">🔍</div>
        <p class="empty-title">没有找到相关结果</p>
        <p class="empty-hint">尝试使用其他关键词或检查拼写</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useSearchStore } from 'src/stores/searchStore'
import { useFavoriteStore } from 'src/stores/favoriteStore'
import { useRouter } from 'vue-router'
import type { PostIndex } from 'src/common/ContentInfo'
import { useQuasar } from 'quasar'

const searchStore = useSearchStore()
const favoriteStore = useFavoriteStore()
const router = useRouter()
const $q = useQuasar()

// Props
interface Props {
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoFocus: false
})

// Emits
const emit = defineEmits<{
  search: [query: string]
  resultClick: [post: PostIndex]
}>()

// Local state
const searchQuery = ref('')
const showHistory = ref(false)
const showResults = ref(false)
const hotTags = ref(['技术', '前端', 'JavaScript', 'React', 'Vue', 'Python', 'AI', '设计'])

// Computed properties
const isSearching = computed(() => searchStore.isSearching)
const searchResults = computed(() => searchStore.searchResults)
const searchError = computed(() => searchStore.searchError)
const searchHistory = computed(() => searchStore.searchHistory)
const hasResults = computed(() => searchStore.hasResults)
const hasHistory = computed(() => searchStore.hasHistory)
const isQueryEmpty = computed(() => searchStore.isQueryEmpty)

// Methods
const handleInput = () => {
  if (searchQuery.value.trim()) {
    showHistory.value = true
    showResults.value = false
  } else {
    showHistory.value = false
    showResults.value = false
  }
}

const handleSearch = async () => {
  if (!searchQuery.value.trim() || isSearching.value) return
  
  showHistory.value = false
  showResults.value = true
  
  try {
    await searchStore.search(searchQuery.value)
    emit('search', searchQuery.value)
    
    // 提供搜索成功反馈
    if (hasResults.value) {
      $q.notify({
        type: 'positive',
        message: `找到 ${searchResults.value.length} 条相关结果`,
        position: 'top-right',
        timeout: 1500
      })
    }
  } catch (error) {
    console.error('搜索失败:', error)
    $q.notify({
      type: 'negative',
      message: '搜索过程中出错，请重试',
      position: 'top-right'
    })
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchStore.clearSearch()
  showHistory.value = false
  showResults.value = false
  
  // 清空后重新聚焦
  nextTick(() => {
    if (props.autoFocus) {
      const searchInput = document.querySelector('.search-input') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    }
  })
}

const searchFromHistory = (query: string) => {
  searchQuery.value = query
  handleSearch()
}

const searchWithTag = (tag: string) => {
  searchQuery.value = tag
  handleSearch()
}

const removeFromHistory = (query: string) => {
  searchStore.removeFromSearchHistory(query)
}

const confirmClearHistory = () => {
  $q.dialog({
    title: '确认清空',
    message: '确定要清空所有搜索历史吗？',
    cancel: true,
    persistent: true,
    color: 'negative',
    okColor: 'negative'
  }).onOk(() => {
    searchStore.clearSearchHistory()
    $q.notify({
      type: 'info',
      message: '搜索历史已清空',
      position: 'top-right'
    })
  })
}

const handleResultClick = (post: PostIndex) => {
  // 添加点击动画效果
  const event = window.event as MouseEvent
  const target = event.target as HTMLElement
  const item = target.closest('.search-result-item')
  if (item) {
    item.classList.add('result-item-clicked')
    setTimeout(() => {
      item.classList.remove('result-item-clicked')
    }, 200)
  }
  
  // 标记为已读
  post.read = true
  // 导航到文章详情
  emit('resultClick', post)
  router.push({ 
    path: '/content', 
    query: { guid: post.guid, rssId: post.rssId } 
  })
}

const handleFavoriteToggle = async (post: PostIndex) => {
  try {
    await favoriteStore.toggleFavorite(post)
    // 更新本地状态以立即反映UI变化
    post.isFavorite = !post.isFavorite
    
    // 添加收藏/取消收藏的动画和提示
    const event = window.event as MouseEvent
    const target = event.target as HTMLElement
    const button = target.closest('.favorite-button')
    if (button) {
      button.classList.add('favorite-animated')
      setTimeout(() => {
        button.classList.remove('favorite-animated')
      }, 300)
    }
    
    $q.notify({
      type: post.isFavorite ? 'positive' : 'info',
      message: post.isFavorite ? '文章已收藏' : '已取消收藏',
      position: 'top-right',
      timeout: 1200
    })
  } catch (error) {
    console.error('收藏操作失败:', error)
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top-right'
    })
  }
}

// 优化的相对时间格式化函数
const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '未知时间'
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    const diffInWeeks = Math.floor(diffInDays / 7)
    
    if (diffInMinutes < 1) {
      return '刚刚'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`
    } else if (diffInDays < 7) {
      return `${diffInDays}天前`
    } else if (diffInWeeks < 4) {
      return `${diffInWeeks}周前`
    } else {
      // 超过一个月显示具体日期
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date)
    }
  } catch (error) {
    return '未知时间'
  }
}

// Lifecycle
onMounted(() => {
  // 加载搜索历史和收藏状态
  searchStore.loadSearchHistory()
  favoriteStore.loadFavoritePosts().catch(error => {
    console.error('加载收藏文章失败:', error)
  })
  
  // 自动聚焦
  if (props.autoFocus) {
    nextTick(() => {
      const searchInput = document.querySelector('.search-input') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    })
  }
})

// 监听输入框焦点变化
const handleFocus = () => {
  if (searchQuery.value.trim() && hasHistory.value) {
    showHistory.value = true
  }
}

const handleBlur = (event: FocusEvent) => {
  // 延迟隐藏历史记录，以便用户可以点击历史项目
  setTimeout(() => {
    const target = event.relatedTarget as HTMLElement
    if (!target || !target.closest('.search-history') || !target.closest('.search-results')) {
      showHistory.value = false
    }
  }, 200)
}

// Watch for external changes
watch(() => searchStore.searchQuery, (newQuery) => {
  if (newQuery !== searchQuery.value) {
    searchQuery.value = newQuery
  }
})
</script>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  margin-bottom: 20px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}

.search-input-wrapper:focus-within {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: #1976d2;
}

.search-input {
  flex: 1;
  padding: 14px 16px;
  border: none;
  outline: none;
  font-size: 16px;
  color: #333;
  background: transparent;
}

.search-input::placeholder {
  color: #999;
  transition: color 0.3s ease;
}

.search-input:focus::placeholder {
  color: #bbb;
}

.search-input:disabled {
  background-color: #f5f5f5;
  color: #999;
}

.search-button {
  padding: 14px 24px;
  background-color: #1976d2;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 0 12px 12px 0;
  min-width: 80px;
}

.search-button:hover:not(:disabled) {
  background-color: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
}

.search-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
}

.search-button:disabled {
  background-color: #e0e0e0;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.clear-button {
  padding: 8px;
  margin-right: 8px;
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.clear-button:hover {
  color: #f44336;
  background-color: rgba(244, 67, 54, 0.1);
}

/* 搜索中动画 */
.searching-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.spinner-dot {
  width: 6px;
  height: 6px;
  background-color: white;
  border-radius: 50%;
  animation: spinner 1.4s infinite ease-in-out both;
}

.spinner-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.spinner-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes spinner {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* 热门搜索标签 */
.hot-tags {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 16px;
  animation: slideDown 0.2s ease-out;
}

.tags-header {
  font-weight: 600;
  color: #666;
  margin-bottom: 12px;
  font-size: 14px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-tag {
  background-color: #f5f5f5;
  border: none;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
}

.hot-tag:hover {
  background-color: #e3f2fd;
  color: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 搜索历史样式 */
.search-history {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  animation: slideDown 0.2s ease-out;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.history-header span {
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.clear-history-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-history-button:hover {
  color: #f44336;
  background-color: rgba(244, 67, 54, 0.1);
}

.history-list {
  padding: 8px 0;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.history-item:hover {
  background-color: #f8f9fa;
  transform: translateX(4px);
}

.history-icon {
  margin-right: 8px;
  font-size: 14px;
  opacity: 0.6;
}

.history-text {
  flex: 1;
  color: #333;
  font-size: 14px;
}

.remove-history-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s ease;
  opacity: 0;
}

.history-item:hover .remove-history-button {
  opacity: 1;
}

.remove-history-button:hover {
  color: #f44336;
  background-color: rgba(244, 67, 54, 0.1);
}

/* 搜索结果样式 */
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 600px;
  overflow-y: auto;
  animation: slideDown 0.2s ease-out;
}

/* 加载状态 */
.search-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #666;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误状态 */
.search-error {
  padding: 40px 20px;
  text-align: center;
  color: #d32f2f;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.search-error p {
  margin-bottom: 16px;
  font-size: 16px;
}

.retry-button {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.retry-button:hover {
  background-color: #1565c0;
}

/* 空状态 */
.search-empty {
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.empty-hint {
  color: #999;
  font-size: 14px;
}

/* 结果列表 */
.results-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.search-results-list {
  padding: 8px 0;
}

.search-result-item {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: #f8f9fa;
  padding-left: 20px;
}

.result-item-clicked {
  background-color: #e3f2fd !important;
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.4;
  font-size: 16px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #999;
}

.result-source {
  background-color: #f0f0f0;
  padding: 2px 8px;
  border-radius: 12px;
  color: #666;
  font-size: 12px;
}

.result-time {
  font-size: 12px;
}

.result-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  margin-top: 8px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  opacity: 0.8;
}

.result-actions {
  display: flex;
  align-items: flex-start;
  margin-top: 4px;
}

.favorite-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  font-size: 22px;
  color: #e0e0e0;
  transition: all 0.2s ease;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.favorite-button:hover {
  background-color: rgba(255, 215, 0, 0.1);
  transform: scale(1.1);
}

.favorite-button.active {
  color: #ffd700;
  transform: scale(1.1);
}

.favorite-animated {
  animation: favoritePop 0.3s ease;
}

@keyframes favoritePop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}

.favorite-icon {
  pointer-events: none;
}

/* 动画效果 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 滚动条样式 */
.search-history::-webkit-scrollbar,
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-history::-webkit-scrollbar-track,
.search-results::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.search-history::-webkit-scrollbar-thumb,
.search-results::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.search-history::-webkit-scrollbar-thumb:hover,
.search-results::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-input-wrapper {
    flex-direction: column;
  }
  
  .search-input {
    width: 100%;
    border-bottom: 1px solid #f0f0f0;
    border-radius: 12px 12px 0 0;
  }
  
  .search-button {
    width: 100%;
    border-radius: 0 0 12px 12px;
    padding: 12px 20px;
  }
  
  .clear-button {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .hot-tags,
  .search-history,
  .search-results {
    left: -8px;
    right: -8px;
    margin: 4px -8px 0;
    border-radius: 8px;
  }
  
  .result-title {
    font-size: 15px;
  }
  
  .result-meta {
    font-size: 12px;
    gap: 8px;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .search-input-wrapper {
    background: #2d2d2d;
    border-color: #444;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .search-input {
    color: #e0e0e0;
  }
  
  .search-input::placeholder {
    color: #888;
  }
  
  .search-input:disabled {
    background-color: #333;
    color: #666;
  }
  
  .hot-tags,
  .search-history,
  .search-results {
    background: #2d2d2d;
    border-color: #444;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .history-item:hover,
  .search-result-item:hover {
    background-color: #3a3a3a;
  }
  
  .history-text,
  .result-title {
    color: #e0e0e0;
  }
  
  .result-desc {
    color: #aaa;
  }
  
  .result-source {
    background-color: #444;
    color: #ccc;
  }
  
  .favorite-button:hover {
    background-color: rgba(255, 215, 0, 0.2);
  }
  
  .result-item-clicked {
    background-color: #1e3a5f !important;
  }
}
</style>