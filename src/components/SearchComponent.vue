<template>
  <div
    class="search-container"
    role="search"
    aria-label="搜索文章"
  >
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <q-icon
        name="search"
        size="20px"
        class="search-leading-icon"
        :class="{ 'search-icon-dark': $q.dark.isActive }"
      />
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        @input="onInput"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
        type="text"
        placeholder="搜索文章标题、作者或内容..."
        class="search-input"
        :disabled="isSearching"
        autocomplete="off"
        spellcheck="false"
        aria-label="搜索文章"
        aria-describedby="search-hint"
        role="combobox"
        :aria-expanded="String(showDropdown)"
        aria-controls="search-results-panel"
        :aria-activedescendant="activeDescendantId"
      />
      <span id="search-hint" class="sr-only">输入关键词搜索，支持上下箭头浏览结果，回车确认</span>

      <!-- 清空按钮 -->
      <q-btn
        v-if="searchQuery"
        flat
        dense
        round
        icon="close"
        size="sm"
        class="clear-button"
        @click="clearSearch"
        @mousedown.prevent
        aria-label="清空搜索框"
      />

      <!-- 搜索/加载按钮 -->
      <q-btn
        :loading="isSearching"
        :disable="!searchQuery.trim()"
        color="primary"
        unelevated
        class="search-button"
        @click="handleSearch"
        aria-label="搜索"
      >
        <template #loading>
          <q-spinner-dots size="20px" />
        </template>
        <span>搜索</span>
      </q-btn>
    </div>

    <!-- 下拉面板（热门标签 / 搜索历史 / 搜索结果） -->
    <Transition name="panel-slide">
      <div
        v-if="showDropdown"
        id="search-results-panel"
        class="search-dropdown"
        role="region"
        aria-label="搜索面板"
        :class="{ 'search-dropdown--dark': $q.dark.isActive }"
      >
        <!-- === 热门搜索标签 === -->
        <div v-if="showHistory && !hasHistory && !isQueryEmpty" class="hot-tags">
          <div class="tags-header">
            <q-icon name="local_fire_department" size="16px" class="q-mr-xs" />
            热门搜索
          </div>
          <div class="tags-container">
            <q-chip
              v-for="tag in hotTags"
              :key="tag"
              clickable
              outline
              color="primary"
              text-color="primary"
              size="sm"
              class="hot-tag"
              @click="searchWithTag(tag)"
              tabindex="0"
              role="option"
              :aria-label="`搜索「${tag}」`"
            >
              {{ tag }}
            </q-chip>
          </div>
        </div>

        <!-- === 搜索历史 === -->
        <div v-else-if="showHistory && hasHistory" class="search-history">
          <div class="history-header">
            <span>
              <q-icon name="history" size="16px" class="q-mr-xs" />
              搜索历史
            </span>
            <q-btn
              flat
              dense
              size="sm"
              color="negative"
              :label="$q.screen.lt.md ? '' : '清空'"
              :icon="$q.screen.lt.md ? 'delete_outline' : undefined"
              @click="confirmClearHistory"
              aria-label="清空搜索历史"
            />
          </div>
          <div class="history-list">
            <div
              v-for="(historyItem, idx) in searchHistory"
              :key="historyItem"
              class="history-item"
              :class="{
                'history-item--focused': activeIndex === idx && focusedSection === 'history',
                'history-item--dark': $q.dark.isActive,
              }"
              role="option"
              :aria-selected="activeIndex === idx && focusedSection === 'history'"
              @click="searchFromHistory(historyItem)"
              @mouseenter="activeIndex = idx; focusedSection = 'history'"
            >
              <q-icon name="schedule" size="16px" class="history-icon" />
              <span class="history-text">{{ historyItem }}</span>
              <q-btn
                flat
                dense
                round
                icon="close"
                size="xs"
                class="remove-history-button"
                @click.stop="removeFromHistory(historyItem)"
                aria-label="移除「{{ historyItem }}」"
              />
            </div>
          </div>
        </div>

        <!-- === 搜索结果 === -->
        <div v-if="showResults" class="search-results-section">
          <!-- 加载中 -->
          <div v-if="isSearching" class="search-status search-status--loading">
            <q-spinner
              color="primary"
              size="36px"
            />
            <span class="search-status__text">正在搜索相关内容...</span>
          </div>

          <!-- 搜索出错 -->
          <div v-else-if="searchError" class="search-status search-status--error">
            <div class="error-visual">
              <q-icon name="error_outline" size="48px" color="negative" />
            </div>
            <p class="error-message">{{ searchError }}</p>
            <q-btn
              color="primary"
              unelevated
              @click="handleSearch"
              aria-label="重试搜索"
            >
              <q-icon name="refresh" size="18px" class="q-mr-xs" />
              重试
            </q-btn>
          </div>

          <!-- 有结果 -->
          <div v-else-if="hasResults" class="search-results-list" role="listbox" aria-label="搜索结果">
            <div class="results-header">
              <q-icon name="article" size="16px" class="q-mr-xs" />
              找到 <strong>{{ searchResults.length }}</strong> 条结果
            </div>
            <div
              v-for="(post, idx) in searchResults"
              :key="post.guid"
              :id="'search-result-' + idx"
              class="search-result-item"
              :class="{
                'search-result-item--focused': activeIndex === idx && focusedSection === 'results',
                'search-result-item--dark': $q.dark.isActive,
              }"
              role="option"
              :aria-selected="activeIndex === idx && focusedSection === 'results'"
              @click="handleResultClick(post)"
              @mouseenter="activeIndex = idx; focusedSection = 'results'"
            >
              <div class="result-content">
                <div class="result-title" v-html="highlightMatch(post.title)"></div>
                <div class="result-meta">
                  <span class="result-source">
                    <q-icon name="rss_feed" size="12px" class="q-mr-xs" />
                    {{ post.author || '未知来源' }}
                  </span>
                  <span class="result-time">{{ formatRelativeTime(post.updateTime) }}</span>
                </div>
                <div
                  v-if="post.desc"
                  class="result-desc"
                  v-html="highlightMatch(post.desc)"
                ></div>
              </div>
              <div class="result-actions">
                <q-btn
                  flat
                  round
                  dense
                  :icon="post.isFavorite ? 'star' : 'star_border'"
                  :color="post.isFavorite ? 'warning' : 'grey-5'"
                  size="sm"
                  @click.stop="handleFavoriteToggle(post)"
                  :aria-label="post.isFavorite ? '取消收藏' : '收藏文章'"
                >
                  <q-tooltip>{{ post.isFavorite ? '取消收藏' : '收藏文章' }}</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>

          <!-- 无结果 -->
          <div v-else class="search-status search-status--empty">
            <div class="empty-visual">
              <q-icon name="search_off" size="56px" :color="$q.dark.isActive ? 'grey-6' : 'grey-4'" />
            </div>
            <p class="empty-title">没有找到相关结果</p>
            <p class="empty-hint">试试其他关键词，或调整搜索条件</p>
            <div class="empty-suggestions">
              <span class="empty-suggestions__label">试试：</span>
              <q-chip
                v-for="tag in suggestionTags"
                :key="tag"
                clickable
                outline
                color="primary"
                size="sm"
                @click="searchWithTag(tag)"
              >
                {{ tag }}
              </q-chip>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useSearchStore } from 'src/stores/searchStore'
import { useFavoriteStore } from 'src/stores/favoriteStore'
import { useRoute, useRouter } from 'vue-router'
import type { PostIndexItem } from 'src/common/models'
import { useQuasar } from 'quasar'
import { formatRelativeTime } from 'src/common/util'

const searchStore = useSearchStore()
const favoriteStore = useFavoriteStore()
const route = useRoute()
const router = useRouter()
const $q = useQuasar()

// ── Props ──
interface Props {
  autoFocus?: boolean
  /** If true, sync search query to URL `?q=` param */
  persistQuery?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoFocus: false,
  persistQuery: true,
})

// ── Emits ──
const emit = defineEmits<{
  search: [query: string]
  resultClick: [post: PostIndexItem]
}>()

// ── Local state ──
const searchQuery = ref('')
const showDropdown = ref(false)
const showHistory = ref(false)
const showResults = ref(false)
const activeIndex = ref(-1)
const focusedSection = ref<'history' | 'results' | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const hotTags = ref(['技术', '前端', 'JavaScript', 'React', 'Vue', 'Python', 'AI', '设计'])
const suggestionTags = ref(['技术', '前端', 'JavaScript', 'React', 'Vue', 'Python', 'AI', '设计'])

// ── Debounce timer ──
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 300

// ── Computed ──
const isSearching = computed(() => searchStore.isSearching)
const searchResults = computed(() => searchStore.searchResults)
const searchError = computed(() => searchStore.searchError)
const searchHistory = computed(() => searchStore.searchHistory)
const hasResults = computed(() => searchStore.hasResults)
const hasHistory = computed(() => searchStore.hasHistory)
const isQueryEmpty = computed(() => searchStore.isQueryEmpty)

// Aria active descendant for keyboard navigation
const activeDescendantId = computed(() => {
  if (activeIndex.value < 0) return undefined
  if (focusedSection.value === 'results') return `search-result-${activeIndex.value}`
  return undefined
})

// ── Input handler with 300ms debounce ──
const onInput = () => {
  showHistory.value = true
  showResults.value = false

  // Clear any existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const trimmed = searchQuery.value.trim()

  if (!trimmed) {
    showDropdown.value = false
    showHistory.value = false
    syncQueryParam('')
    return
  }

  showDropdown.value = true

  // Debounced auto-search for non-empty queries
  debounceTimer = setTimeout(() => {
    if (searchQuery.value.trim()) {
      handleSearch()
    }
    debounceTimer = null
  }, DEBOUNCE_MS)
}

// ── Keyboard navigation ──
const onKeydown = (e: KeyboardEvent) => {
  const totalItems =
    focusedSection.value === 'history'
      ? searchHistory.value.length
      : focusedSection.value === 'results'
        ? searchResults.value.length
        : 0

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault()
      if (!showDropdown.value) {
        showDropdown.value = true
        showHistory.value = true
        if (hasHistory.value) {
          focusedSection.value = 'history'
          activeIndex.value = 0
        } else if (hasResults.value) {
          focusedSection.value = 'results'
          activeIndex.value = 0
        }
        return
      }
      // Determine section if not set
      if (!focusedSection.value) {
        if (hasResults.value) {
          focusedSection.value = 'results'
          activeIndex.value = 0
        } else if (hasHistory.value) {
          focusedSection.value = 'history'
          activeIndex.value = 0
        }
        return
      }
      if (activeIndex.value < totalItems - 1) {
        activeIndex.value++
      }
      scrollToActive()
      break
    }
    case 'ArrowUp': {
      e.preventDefault()
      if (activeIndex.value > 0) {
        activeIndex.value--
      } else if (activeIndex.value === 0) {
        // At top, switch section or stay
        if (focusedSection.value === 'results' && hasHistory.value) {
          focusedSection.value = 'history'
          activeIndex.value = searchHistory.value.length - 1
        }
      }
      scrollToActive()
      break
    }
    case 'Enter': {
      if (focusedSection.value === 'results' && searchResults.value[activeIndex.value]) {
        handleResultClick(searchResults.value[activeIndex.value])
      } else if (focusedSection.value === 'history' && searchHistory.value[activeIndex.value]) {
        searchFromHistory(searchHistory.value[activeIndex.value])
      } else {
        handleSearch()
      }
      break
    }
    case 'Escape': {
      e.preventDefault()
      closeDropdown()
      searchInputRef.value?.blur()
      break
    }
  }
}

const scrollToActive = () => {
  nextTick(() => {
    const items = document.querySelectorAll('.search-result-item, .history-item')
    const target = items[activeIndex.value] as HTMLElement
    target?.scrollIntoView({ block: 'nearest' })
  })
}

// ── Focus / Blur ──
const onFocus = () => {
  if (searchQuery.value.trim()) {
    showDropdown.value = true
    showHistory.value = true
  }
}

const onBlur = () => {
  // Delay to allow click events on dropdown items to fire first
  setTimeout(() => {
    closeDropdown()
  }, 200)
}

const closeDropdown = () => {
  showDropdown.value = false
  showHistory.value = false
  showResults.value = false
  activeIndex.value = -1
  focusedSection.value = null
}

// ── Search execution ──
const handleSearch = async () => {
  const trimmed = searchQuery.value.trim()
  if (!trimmed || isSearching.value) return

  showHistory.value = false
  showResults.value = true
  showDropdown.value = true
  focusedSection.value = 'results'
  activeIndex.value = -1
  syncQueryParam(trimmed)

  try {
    await searchStore.search(trimmed)
    emit('search', trimmed)

    // Provide feedback
    if (hasResults.value) {
      $q.notify({
        type: 'positive',
        message: `找到 ${searchResults.value.length} 条相关结果`,
        position: 'top-right',
        timeout: 1500,
      })
    }
  } catch (error) {
    console.error('搜索失败:', error)
    $q.notify({
      type: 'negative',
      message: '搜索过程中出错，请重试',
      position: 'top-right',
    })
  }
}

// ── Sync query to URL ──
const syncQueryParam = (q: string) => {
  if (!props.persistQuery) return
  const current = route.query.q
  if (current === q || (!current && !q)) return
  router.replace({ query: q ? { q } : undefined })
}

// ── Clear ──
const clearSearch = () => {
  searchQuery.value = ''
  searchStore.clearSearch()
  showDropdown.value = false
  showHistory.value = false
  showResults.value = false
  activeIndex.value = -1
  focusedSection.value = null
  syncQueryParam('')

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  nextTick(() => {
    if (props.autoFocus) {
      searchInputRef.value?.focus()
    }
  })
}

// ── History actions ──
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
    ok: { color: 'negative' },
  }).onOk(() => {
    searchStore.clearSearchHistory()
    $q.notify({
      type: 'info',
      message: '搜索历史已清空',
      position: 'top-right',
    })
  })
}

// ── Result click → navigate to Content ──
const handleResultClick = (post: PostIndexItem) => {
  closeDropdown()

  // Ensure rssId is present for navigation
  const rssId = post.rssId || ''
  if (!rssId) {
    console.warn('[SearchComponent] Cannot navigate: post has no rssId', post)
    $q.notify({
      type: 'warning',
      message: '无法打开该文章：缺少来源信息',
      position: 'top-right',
    })
    return
  }

  emit('resultClick', post)
  router.push({
    name: 'Content',
    query: { rssId, postId: post.guid },
  })
}

// ── Favorite toggle ──
const handleFavoriteToggle = async (post: PostIndexItem) => {
  try {
    const result = await favoriteStore.toggleFavorite(post)
    // Update local UI state to match server result
    post.isFavorite = result.favorited
    $q.notify({
      type: result.favorited ? 'positive' : 'info',
      message: result.favorited ? '文章已收藏' : '已取消收藏',
      position: 'top-right',
      timeout: 1200,
    })
  } catch (error) {
    console.error('收藏操作失败:', error)
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top-right',
    })
  }
}

// ── Highlight matching text ──
const highlightMatch = (text: string): string => {
  if (!text || !searchQuery.value.trim()) return text || ''
  const query = searchQuery.value.trim()
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

// ── Lifecycle ──
onMounted(() => {
  // Restore search query from URL query param
  if (props.persistQuery && route.query.q) {
    const q = String(route.query.q)
    searchQuery.value = q
    searchStore.searchQuery = q
    // Auto-search on mount if query param is present
    if (q.trim()) {
      nextTick(() => handleSearch())
    }
  }

  // Load search history and favorites
  searchStore.loadSearchHistory()
  favoriteStore.loadFavoritePosts().catch((error) => {
    console.error('加载收藏文章失败:', error)
  })

  // Auto-focus
  if (props.autoFocus) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})

// ── Watch external query ──
watch(
  () => route.query.q,
  (newQ) => {
    if (!props.persistQuery) return
    const q = String(newQ || '')
    if (q !== searchQuery.value) {
      searchQuery.value = q
      if (q.trim()) {
        nextTick(() => handleSearch())
      } else {
        clearSearch()
      }
    }
  },
)

watch(
  () => searchStore.searchQuery,
  (newQuery) => {
    if (newQuery !== searchQuery.value) {
      searchQuery.value = newQuery
    }
  },
)
</script>

<style scoped>
/* ── Screen-reader only ── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Container ── */
.search-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  margin-bottom: 20px;
}

/* ── Input wrapper ── */
.search-input-wrapper {
  display: flex;
  align-items: center;
  background: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}

.search-input-wrapper:focus-within {
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.15);
  border-color: #1976d2;
}

.search-leading-icon {
  padding-left: 14px;
  color: #999;
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.search-input-wrapper:focus-within .search-leading-icon {
  color: #1976d2;
}

.search-icon-dark {
  color: #888;
}

.search-input {
  flex: 1;
  padding: 12px 12px;
  border: none;
  outline: none;
  font-size: 15px;
  color: #333;
  background: transparent;
  min-width: 0;
}

.search-input::placeholder {
  color: #aaa;
  transition: color 0.3s ease;
}

.search-input:focus::placeholder {
  color: #ccc;
}

.search-input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.clear-button {
  flex-shrink: 0;
  margin-right: 4px;
  color: #999;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #f44336;
}

.search-button {
  flex-shrink: 0;
  height: 44px;
  border-radius: 0 12px 12px 0 !important;
  min-width: 80px;
  font-weight: 500;
}

/* ── Dropdown panel ── */
.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  max-height: 540px;
  overflow-y: auto;
  overflow-x: hidden;
}

.search-dropdown--dark {
  background: #2d2d2d;
  border-color: #444;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ── Panel slide transition ── */
.panel-slide-enter-active {
  transition: all 0.2s ease-out;
}

.panel-slide-leave-active {
  transition: all 0.15s ease-in;
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Hot tags ── */
.hot-tags {
  padding: 16px;
}

.tags-header {
  display: flex;
  align-items: center;
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
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.hot-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.hot-tag:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

/* ── Search history ── */
.search-history {
  max-height: 300px;
  overflow-y: auto;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.history-header span {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.history-list {
  padding: 4px 0;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  gap: 8px;
}

.history-item:hover,
.history-item--focused {
  background-color: #f5f5f5;
}

.history-item--dark:hover,
.history-item--dark.history-item--focused {
  background-color: #3a3a3a;
}

.history-icon {
  color: #aaa;
  flex-shrink: 0;
}

.history-text {
  flex: 1;
  color: #333;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-history-button {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: #999;
}

.history-item:hover .remove-history-button,
.history-item--focused .remove-history-button {
  opacity: 1;
}

.remove-history-button:hover {
  color: #f44336;
}

/* ── Results section ── */
.search-results-section {
  /* container for all result states */
}

.results-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  color: #666;
  font-size: 14px;
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.search-results-list {
  padding: 4px 0;
}

.search-result-item {
  display: flex;
  padding: 14px 16px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background-color 0.15s ease, padding-left 0.15s ease;
  gap: 12px;
  align-items: flex-start;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover,
.search-result-item--focused {
  background-color: #f5f5f5;
  padding-left: 20px;
}

.search-result-item--dark:hover,
.search-result-item--dark.search-result-item--focused {
  background-color: #3a3a3a;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
  line-height: 1.4;
  font-size: 15px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Search keyword highlight */
:deep(.search-highlight) {
  background-color: #fff3cd;
  color: #856404;
  padding: 0 2px;
  border-radius: 2px;
}

.body--dark :deep(.search-highlight) {
  background-color: #5a4a1e;
  color: #ffd54f;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.result-source {
  display: inline-flex;
  align-items: center;
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
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  margin-top: 6px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  opacity: 0.75;
}

.result-actions {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  padding-top: 2px;
}

/* ── Status states (loading / error / empty) ── */
.search-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  text-align: center;
  gap: 12px;
}

.search-status--loading {
  gap: 16px;
}

.search-status__text {
  color: #666;
  font-size: 14px;
}

.error-visual {
  margin-bottom: 4px;
}

.error-message {
  color: #c62828;
  font-size: 14px;
  margin: 0;
  max-width: 280px;
  word-break: break-word;
}

.empty-visual {
  margin-bottom: 4px;
  opacity: 0.8;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: #555;
  margin: 0;
}

.empty-hint {
  color: #999;
  font-size: 13px;
  margin: 0;
}

.empty-suggestions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.empty-suggestions__label {
  font-size: 13px;
  color: #999;
}

/* ── Dark mode (applicable to all above) ── */
.body--dark .search-input-wrapper {
  background: #2d2d2d;
  border-color: #555;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.body--dark .search-input-wrapper:focus-within {
  border-color: #5c9eff;
  box-shadow: 0 4px 16px rgba(92, 158, 255, 0.15);
}

.body--dark .search-input-wrapper:focus-within .search-leading-icon {
  color: #5c9eff;
}

.body--dark .search-input {
  color: #e0e0e0;
}

.body--dark .search-input::placeholder {
  color: #777;
}

.body--dark .search-input:disabled {
  background-color: #333;
  color: #666;
}

.body--dark .search-dropdown {
  background: #2d2d2d;
  border-color: #444;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.body--dark .hot-tags .tags-header,
.body--dark .history-header span,
.body--dark .results-header {
  color: #aaa;
}

.body--dark .history-item,
.body--dark .search-result-item {
  border-color: #3a3a3a;
}

.body--dark .history-text,
.body--dark .result-title {
  color: #e0e0e0;
}

.body--dark .result-desc {
  color: #aaa;
}

.body--dark .result-source {
  background-color: #444;
  color: #bbb;
}

.body--dark .result-time {
  color: #888;
}

.body--dark .search-status__text {
  color: #aaa;
}

.body--dark .error-message {
  color: #ef5350;
}

.body--dark .empty-title {
  color: #bbb;
}

.body--dark .empty-hint {
  color: #777;
}

.body--dark .history-header,
.body--dark .results-header {
  border-color: #3a3a3a;
}

.body--dark .history-icon {
  color: #666;
}

/* ── Scrollbar ── */
.search-dropdown::-webkit-scrollbar {
  width: 6px;
}

.search-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.search-dropdown::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
  transition: background 0.2s ease;
}

.search-dropdown::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.body--dark .search-dropdown::-webkit-scrollbar-thumb {
  background: #555;
}

.body--dark .search-dropdown::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* ── Keyboard focus ── */
.search-input:focus-visible {
  outline: none;
}

.search-result-item:focus-visible,
.history-item:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: -2px;
}

.hot-tag:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.body--dark .search-result-item:focus-visible,
.body--dark .history-item:focus-visible,
.body--dark .hot-tag:focus-visible {
  outline-color: #5c9eff;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .search-input-wrapper {
    border-radius: 10px;
  }

  .search-input {
    padding: 10px 8px;
    font-size: 14px;
  }

  .search-leading-icon {
    padding-left: 10px;
    font-size: 18px !important;
  }

  .search-button {
    height: 40px;
    min-width: 64px;
    border-radius: 0 10px 10px 0 !important;
    font-size: 13px;
  }

  .search-dropdown {
    left: -4px;
    right: -4px;
    border-radius: 10px;
    max-height: 440px;
  }

  .result-title {
    font-size: 14px;
  }

  .result-meta {
    font-size: 11px;
    gap: 6px;
  }

  .result-desc {
    font-size: 12px;
  }

  .search-result-item {
    padding: 10px 12px;
  }

  .search-status {
    padding: 28px 16px;
  }

  .hot-tags {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .search-button {
    min-width: 48px;
    font-size: 0;
  }

  .search-button .q-icon {
    margin: 0 !important;
  }

  .search-button::before {
    content: '搜索' / '';
    font-size: 0;
  }
}
</style>
