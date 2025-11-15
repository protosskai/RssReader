<template>
  <q-drawer v-model="leftDrawerOpen" side="left" elevated overlay>
    <q-toolbar class="bg-grey-2">
      <q-input
        rounded
        outlined
        dense
        class="WAL__field full-width"
        bg-color="white"
        v-model="searchQuery"
        placeholder="搜索订阅源或文章"
        @update:model-value="handleSearch"
      >
        <template v-slot:prepend>
          <q-icon name="search"/>
        </template>
        <template v-slot:append>
          <q-btn
            v-if="searchQuery"
            flat
            dense
            round
            icon="clear"
            @click="clearSearch"
          />
        </template>
      </q-input>
    </q-toolbar>

    <!-- 搜索结果区域 -->
    <div v-if="searchQuery && isSearching" class="search-loading q-pa-md text-center">
      <q-spinner color="primary" size="2em"/>
      <div class="text-grey-6 q-mt-sm">搜索中...</div>
    </div>

    <div v-else-if="searchQuery && searchResults.length > 0" class="search-results">
      <div class="q-pa-sm text-grey-6 text-caption">搜索结果 ({{ searchResults.length }})</div>
      <q-list separator>
        <q-item
          v-for="article in searchResults"
          :key="article.guid"
          clickable
          @click="openArticle(article)"
          class="search-result-item"
        >
          <q-item-section>
            <q-item-label class="text-weight-medium ellipsis-2-lines">
              {{ article.title }}
            </q-item-label>
            <q-item-label caption class="text-grey-6 ellipsis">
              {{ article.author }} · {{ formatDate(article.updateTime) }}
            </q-item-label>
            <q-item-label caption class="text-grey-8 ellipsis-3-lines q-mt-xs">
              {{ article.desc }}
            </q-item-label>
          </q-item-section>
          <q-item-section side v-if="article.read">
            <q-icon name="visibility" color="grey-5" size="sm"/>
          </q-item-section>
        </q-item>
      </q-list>
      <div class="q-pa-sm text-center">
        <q-btn
          flat
          dense
          color="primary"
          label="查看更多搜索结果"
          @click="viewAllResults"
          size="sm"
        />
      </div>
    </div>

    <!-- 当有搜索查询但无结果时显示 -->
    <div v-else-if="searchQuery && !isSearching" class="search-no-results q-pa-md text-center">
      <q-icon name="search_off" size="3em" color="grey-5"/>
      <div class="text-grey-6 q-mt-sm">没有找到相关文章</div>
    </div>

    <!-- 订阅源列表（当没有搜索时显示） -->
    <subscription-list v-if="!searchQuery"/>

    <edit-folder-dialog/>
  </q-drawer>
</template>

<script setup lang="ts">
import {computed, inject, onMounted, provide, Ref, ref} from "vue";
import {RSS_FOLDER_LIST_REF, TOGGLE_LAYOUT_LEFT_DRAWER_REF} from "src/const/InjectionKey";
import SubscriptionList from "components/SubscriptionList.vue";
import {useRssInfoStore} from "stores/rssInfoStore";
import EditFolderDialog from "components/EditFolderDialog.vue";
import { useSearchStore } from 'src/stores/searchStore';
import type { PostIndexItem } from 'src/electron/storage/common';

const store = useRssInfoStore()
const searchStore = useSearchStore()
const searchQuery = ref('')
const searchResults = ref<PostIndexItem[]>([])
const isSearching = ref(false)
const leftDrawerOpen = inject(TOGGLE_LAYOUT_LEFT_DRAWER_REF)

provide(RSS_FOLDER_LIST_REF, computed(() => store.rssFolderList))

// 处理搜索
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    // 执行全局搜索
    await searchStore.search(searchQuery.value)
    searchResults.value = searchStore.searchResults.slice(0, 10) // 只显示前10个结果
  } catch (error) {
    console.error('[AppDrawer] Search failed:', error)
  } finally {
    isSearching.value = false
  }
}

// 清空搜索
const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

// 打开文章
const openArticle = (article: PostIndexItem) => {
  // 导航到文章内容页
  window.location.hash = `/#/content?guid=${article.guid}`
  // 清空搜索以显示订阅源列表
  searchQuery.value = ''
}

// 查看所有搜索结果
const viewAllResults = () => {
  // TODO: 导航到专门的搜索结果页面
  console.log('[AppDrawer] View all search results')
}
</script>

<style lang="scss" scoped>
.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.search-result-item {
  &:hover {
    background: rgba(0, 0, 0, 0.03);

    .dark & {
      background: rgba(255, 255, 255, 0.05);
    }
  }
}

.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ellipsis-3-lines {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.search-loading,
.search-no-results {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
