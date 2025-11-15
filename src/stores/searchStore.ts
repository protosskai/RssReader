import { defineStore } from 'pinia'
import type { PostIndex } from 'src/common/ContentInfo'
import { ref, computed } from 'vue'

export const useSearchStore = defineStore('search', () => {
  // 状态
  const searchQuery = ref('')
  const searchResults = ref<PostIndex[]>([])
  const isSearching = ref(false)
  const searchError = ref<string | null>(null)
  const searchHistory = ref<string[]>([])
  const maxHistoryItems = 10

  // 计算属性
  const hasResults = computed(() => searchResults.value.length > 0)
  const hasHistory = computed(() => searchHistory.value.length > 0)
  const isQueryEmpty = computed(() => searchQuery.value.trim() === '')

  // 方法
  /**
   * 执行搜索
   * @param query 搜索关键词
   * @param posts 要搜索的文章列表
   */
  const search = async (query: string, posts: PostIndex[] = []) => {
    if (!query.trim()) {
      searchResults.value = []
      return
    }

    try {
      isSearching.value = true
      searchError.value = null
      searchQuery.value = query

      // 如果提供了文章列表，则在本地搜索
      if (posts.length > 0) {
        performLocalSearch(query, posts)
      } else {
        // 否则调用electronAPI进行全局搜索
        await performGlobalSearch(query)
      }

      // 保存到搜索历史
      addToSearchHistory(query)
    } catch (error) {
      console.error('搜索失败:', error)
      searchError.value = error instanceof Error ? error.message : '搜索失败'
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * 本地搜索（用于前端过滤）
   */
  const performLocalSearch = (query: string, posts: PostIndex[]) => {
    const lowerQuery = query.toLowerCase()
    searchResults.value = posts.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) ||
      post.author.toLowerCase().includes(lowerQuery) ||
      (post.desc && post.desc.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * 全局搜索（调用后端API）
   */
  const performGlobalSearch = async (query: string) => {
    try {
      // 调用electronAPI进行全局搜索
      const results = await window.electronAPI.searchPosts(query)
      searchResults.value = results
    } catch (error) {
      console.error('全局搜索失败:', error)
      throw error
    }
  }

  /**
   * 添加到搜索历史
   */
  const addToSearchHistory = (query: string) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    // 移除重复项
    searchHistory.value = searchHistory.value.filter(item => item !== trimmedQuery)
    
    // 添加到开头
    searchHistory.value.unshift(trimmedQuery)
    
    // 限制历史记录数量
    if (searchHistory.value.length > maxHistoryItems) {
      searchHistory.value = searchHistory.value.slice(0, maxHistoryItems)
    }
    
    // 保存到本地存储
    saveSearchHistory()
  }

  /**
   * 从搜索历史中删除
   */
  const removeFromSearchHistory = (query: string) => {
    searchHistory.value = searchHistory.value.filter(item => item !== query)
    saveSearchHistory()
  }

  /**
   * 清空搜索历史
   */
  const clearSearchHistory = () => {
    searchHistory.value = []
    saveSearchHistory()
  }

  /**
   * 保存搜索历史到本地存储
   */
  const saveSearchHistory = () => {
    try {
      localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
    } catch (error) {
      console.error('保存搜索历史失败:', error)
    }
  }

  /**
   * 从本地存储加载搜索历史
   */
  const loadSearchHistory = () => {
    try {
      const savedHistory = localStorage.getItem('searchHistory')
      if (savedHistory) {
        searchHistory.value = JSON.parse(savedHistory)
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error)
      searchHistory.value = []
    }
  }

  /**
   * 清空搜索结果
   */
  const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
    searchError.value = null
  }

  /**
   * 从历史记录中执行搜索
   */
  const searchFromHistory = (query: string, posts: PostIndex[] = []) => {
    searchQuery.value = query
    search(query, posts)
  }

  // 初始化时加载搜索历史
  loadSearchHistory()

  return {
    // 状态
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    searchHistory,
    
    // 计算属性
    hasResults,
    hasHistory,
    isQueryEmpty,
    
    // 方法
    search,
    clearSearch,
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,
    searchFromHistory
  }
})