<template>
  <q-page class="content-page">
    <!-- 工具栏 -->
    <div class="toolbar q-mb-md">
      <q-btn icon="arrow_back" flat round @click="goBack">
        <q-tooltip>返回</q-tooltip>
      </q-btn>
      <q-space/>
      <q-btn icon="text_decrease" flat round @click="decreaseFontSize">
        <q-tooltip>减小字体</q-tooltip>
      </q-btn>
      <span class="q-mx-sm text-body2">{{ fontSize }}%</span>
      <q-btn icon="text_increase" flat round @click="increaseFontSize">
        <q-tooltip>增大字体</q-tooltip>
      </q-btn>
      <q-btn icon="open_in_new" flat round @click="openInBrowser" v-if="curContentInfo.link">
        <q-tooltip>在浏览器中打开</q-tooltip>
      </q-btn>
    </div>

    <q-item style="width: 100%;">
      <q-item-section>
        <q-item-label v-if="curContentInfo.rssSource"
                      lines="1"
                      class="text-h6 text-primary url"
                      style="margin-bottom: 5px"
                      @click="openUrl(curContentInfo.rssSource.htmlUrl)">
          {{ curContentInfo.rssSource.name }}
        </q-item-label>
        <q-separator/>

        <q-item-label lines="2" class="text-h5 url" style="margin-top: 15px" @click="openUrl(curContentInfo.link)">
          {{ curContentInfo.title }}
        </q-item-label>

        <q-item-label lines="1" class="text-h6 text-weight-light" v-if="curContentInfo.author">
          {{ curContentInfo.author }}
        </q-item-label>
      </q-item-section>
    </q-item>
    
    <div v-if="error" class="error-message">
      <q-card color="negative" text-color="white">
        <q-card-section>
          <h3>加载失败</h3>
          <p>{{ error }}</p>
          <q-btn label="返回列表" color="white" text-color="negative" @click="goBack" class="q-mt-md"/>
        </q-card-section>
      </q-card>
    </div>
    
    <div v-else-if="curContentInfo" v-html="curContentInfo.content" class="content-area" :style="{ fontSize: fontSize + '%' }">
    </div>
    
    <q-spinner-dots v-if="loading" class="q-ma-auto q-my-xl" size="50px" color="primary"/>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute, useRouter} from "vue-router";
import type {ContentInfo} from "src/common/ContentInfo";
import {onMounted, ref, Ref} from "vue";
import {useQuasar} from "quasar";

const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const {RssId, PostId} = route.params;
const rssId: any = RssId;

// 添加加载状态和错误状态
const loading = ref(false);
const error = ref<string | null>(null);
const retryCount = ref(0);
const maxRetryCount = 2;

// 字体大小控制
const fontSize = ref(100);

const increaseFontSize = () => {
  if (fontSize.value < 200) {
    fontSize.value += 10;
    localStorage.setItem('contentFontSize', fontSize.value.toString());
  }
};

const decreaseFontSize = () => {
  if (fontSize.value > 60) {
    fontSize.value -= 10;
    localStorage.setItem('contentFontSize', fontSize.value.toString());
  }
};

const openInBrowser = () => {
  if (curContentInfo.value?.link) {
    window.electronAPI.openLink(curContentInfo.value.link);
  }
};

// 定义一个兼容的局部接口，用于初始值
interface PartialContentInfo {
  title: string;
  content: string;
  author?: string;
  updateTime?: string;
  link: string;
  rssId: string;
  rssSource?: {name: string; htmlUrl: string};
}

// 使用局部接口作为初始值类型，运行时会被实际的ContentInfo对象替换
const curContentInfo: Ref<ContentInfo> = ref({
  title: '',
  content: '',
  author: '',
  updateTime: '',
  link: '',
  rssId: '',
  rssSource: {
    rssId: '',
    url: '',
    name: '',
    folder: '',
    avatar: '',
    htmlUrl: ''
  }
});

const getContentById = async (postId: string): Promise<ContentInfo | null> => {
  console.log('[Content.vue] getContentById called with postId:', postId);
  loading.value = true;
  error.value = null;
  
  try {
    // 验证PostId有效性
    if (!postId || typeof postId !== 'string' || postId.trim() === '' || postId === 'undefined' || postId === 'null') {
      console.warn('[Content.vue] Invalid article ID:', postId);
      return {
        title: '文章内容',
        content: '<p>无效的文章ID，无法加载内容。</p>',
        author: '',
        updateTime: new Date().toISOString(),
        link: '',
        rssId: rssId || '',
        rssSource: {
          rssId: rssId || '',
          url: '',
          name: '未知来源',
          folder: '',
          avatar: '',
          htmlUrl: ''
        }
      };
    }
    
    // 检查是否是临时ID或基于标题生成的ID
    const isTempId = postId.startsWith('temp_');
    const isTitleBasedId = postId.startsWith('title_');
    
    // 如果是临时ID或基于标题生成的ID，创建一个默认的内容对象
    if (isTempId || isTitleBasedId) {
      console.warn(`[Content.vue] Using ${isTitleBasedId ? 'title-based ID' : 'temporary ID'}, creating default content`);
      return {
        title: '文章内容',
        content: '<p>此文章的内容暂时无法获取。可能是因为文章ID不存在或数据尚未完全同步。</p><p>请稍后尝试刷新或重新选择文章。</p>',
        author: '',
        updateTime: new Date().toISOString(),
        link: '',
        rssId: rssId || '',
        rssSource: {
          rssId: rssId || '',
          url: '',
          name: '未知来源',
          folder: '',
          avatar: '',
          htmlUrl: ''
        }
      };
    }
    
    // 重试逻辑
    let result;
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`[Content.vue] Attempt ${attempt + 1} to fetch content for postId:`, postId);
        result = await window.electronAPI.queryPostContentByGuid(postId);
        console.log('[Content.vue] getContentById received result:', result);
        break; // 成功获取到内容，跳出循环
      } catch (retryError: unknown) {
        attempt++;
        console.warn(`[Content.vue] Attempt ${attempt} failed, retrying...`, retryError);
        
        // 如果是最后一次尝试，则抛出错误
        if (attempt >= maxAttempts) {
          throw retryError;
        }
        
        // 延迟重试，增加重试间隔时间
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
    
    // 重置重试计数
    retryCount.value = 0;
    
    // 确保result存在且rssSource对象包含所有必需的字段
    if (result && result.rssSource) {
      const source = result.rssSource;
      // 如果缺少必需字段，提供默认值
      result.rssSource = {
        rssId: source.rssId || '',
        url: source.url || '',
        name: source.name || '',
        folder: source.folder || '',
        avatar: source.avatar || '',
        htmlUrl: source.htmlUrl || ''
      };
    }
    
    return result as ContentInfo;
  } catch (error: unknown) {
    console.error('[Content.vue] getContentById error after retries:', error);
    
    // 创建一个友好的错误页面内容
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      title: '文章内容暂时无法获取',
      content: `<div style="text-align:center; padding:40px;">\n` +
               `<h2>文章不存在或已被移除</h2>\n` +
               `<p style="margin: 20px 0;">${errorMessage || '文章的内容暂时无法获取，可能是因为文章ID不存在或数据尚未完全同步。'}</p>\n` +
               `<div class="retry-actions" style="margin-top: 30px;">\n` +
               `<button onclick="location.reload()" style="padding: 10px 20px; margin-right: 10px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">刷新页面</button>\n` +
               `<button onclick="window.history.back()" style="padding: 10px 20px; background-color: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">返回列表</button>\n` +
               `</div>\n` +
               `</div>`,
      author: '',
      updateTime: new Date().toISOString(),
      link: '',
      rssId: rssId || '',
      rssSource: {
        rssId: rssId || '',
        url: '',
        name: '未知来源',
        folder: '',
        avatar: '',
        htmlUrl: ''
      }
    };
  } finally {
    loading.value = false;
  }
}

const goBack = () => {
  // 如果有rssId，返回到对应的文章列表
  if (rssId) {
    router.push({
      name: 'PostList',
      params: { RssId: rssId }
    });
  } else {
    // 否则返回首页
    router.push({
      name: 'Home'
    });
  }
}

onMounted(async () => {
  console.log('[Content.vue] onMounted: route params:', { RssId, PostId });
  
  // 恢复字体大小设置
  const savedFontSize = localStorage.getItem('contentFontSize');
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10);
  }
  
  // 重置状态
  loading.value = true;
  error.value = null;
  retryCount.value = 0;
  
  try {
    // 不再直接返回，而是尝试获取内容，即使PostId无效
    const contentInfo = await getContentById(String(PostId || ''));
    if (contentInfo) {
      curContentInfo.value = contentInfo;
      console.log('[Content.vue] onMounted: content loaded successfully');
    } else {
      // 处理没有返回内容的情况
      console.warn('[Content.vue] No content returned for PostId:', PostId);
      curContentInfo.value = {
        title: '请选择文章',
        content: '<div style="text-align:center; padding:40px;">\n' +
                 '<h3>欢迎使用RSS阅读器</h3>\n' +
                 '<p style="margin-top: 20px;">请在左侧列表中选择一篇文章查看内容。</p>\n' +
                 '</div>',
        link: '',
        author: '',
        updateTime: new Date().toISOString(),
        rssId: rssId || '',
        rssSource: {
          rssId: rssId || '',
          url: '',
          name: '未知来源',
          folder: '',
          avatar: '',
          htmlUrl: ''
        }
      };
    }
  } catch (err: unknown) {
    console.error('[Content.vue] onMounted error:', err instanceof Error ? err.message : String(err));
    error.value = '初始化页面内容时出错';
    
    // 设置一个友好的错误内容
    curContentInfo.value = {
      title: '页面加载失败',
      content: '<div style="text-align:center; padding:40px;">\n' +
               '<h2>加载失败</h2>\n' +
               '<p style="margin: 20px 0;">页面初始化时出现错误，请刷新重试。</p>\n' +
               '<button onclick="location.reload()" style="padding: 10px 20px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">刷新页面</button>\n' +
               '</div>',
      author: '',
      updateTime: new Date().toISOString(),
      link: '',
      rssId: rssId || '',
      rssSource: {
        rssId: rssId || '',
        url: '',
        name: '未知来源',
        folder: '',
        avatar: '',
        htmlUrl: ''
      }
    };
  } finally {
    loading.value = false;
  }
})

const openUrl = (url: string) => {
  if (url && typeof url === 'string' && url.trim() !== '') {
    window.electronAPI.openLink(url);
  } else {
    console.warn('[Content.vue] 无效的URL:', url);
  }
}
</script>

<style scoped lang="scss">
.content-page {
  padding-left: 25px;
  padding-right: 25px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

.toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 16px;
}

.content-area {
  width: 100%;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  transition: font-size 0.2s ease;
  line-height: 1.8;

  :deep(img) {
    max-width: 80%;
    height: auto;
  }

  :deep(h1) {
    font-size: 32px;
  }

  :deep(h2) {
    font-size: 24px;
  }

  :deep(h3) {
    font-size: 18px;
  }

  :deep(h4) {
    font-size: 16px;
  }

  :deep(h5) {
    font-size: 13px;
  }

  :deep(h6) {
    font-size: 10px;
  }

  :deep(h1, h2, h3, h4, h5, h6) {
    color: #444;
    margin-top: 3px;
    margin-bottom: 3px;
  }

  :deep(a) {
    color: $primary;
  }

  :deep(pre) {
    background-color: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
  }

  :deep(code) {
    background-color: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
  }
}

.url {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
