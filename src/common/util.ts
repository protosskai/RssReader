import {router} from 'src/router'

export const switchPage = (name: string, params?: any) => {
  router!.push({
    name,
    params,
  });
}

export const extractTextFromHtml = (html: string): string => {
  return html.replace(/<[^>]*(>|$)| |‌|»|«|>/g, '')
}

/**
 * Format a date string as a relative time description in Chinese.
 * e.g. "刚刚", "3分钟前", "2小时前", "5天前", "3周前", or a formatted date.
 */
export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '未知时间'

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '未知时间'

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
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date)
    }
  } catch {
    return '未知时间'
  }
}
