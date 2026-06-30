/**
 * Content Sanitization Utility
 * 使用 DOMPurify 对从 RSS 源获取的不可信内容进行消毒
 */

import DOMPurify from 'dompurify';

// DOMPurify 配置：允许基本的富文本标签，但阻止 script 标签和事件处理器
const purifyConfig: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code',
    'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div',
    'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre',
    'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'summary',
    'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
    'tr', 'u', 'ul', 'var'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height',
    'class', 'id', 'style', 'lang', 'dir', 'align', 'valign',
    'colspan', 'rowspan', 'headers', 'scope',
    'datetime', 'download', 'hreflang', 'name', 'type'
  ],
  ALLOW_DATA_ATTR: true,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'onreset', 'onscroll', 'onresize', 'onabort', 'onbeforeunload',
    'onhashchange', 'onpopstate', 'onstorage', 'onunload', 'onpointerdown', 'onpointerup',
    'onpointermove', 'onpointerenter', 'onpointerleave', 'onwheel', 'ondrag', 'ondrop',
    'oncopy', 'oncut', 'onpaste', 'onanimationstart', 'onanimationend', 'onanimationiteration',
    'ontransitionend', 'ontransitioncancel', 'ontransitionrun', 'ontransitionstart',
    'onauxclick', 'oncontextmenu', 'ondblclick', 'onmousedown', 'onmouseenter',
    'onmouseleave', 'onmousemove', 'onmouseup', 'ontouchcancel', 'ontouchend',
    'ontouchmove', 'ontouchstart', 'onpointercancel', 'ongotpointercapture',
    'onlostpointercapture', 'onselectstart', 'onselectionchange'],
};

/**
 * 对 HTML 内容进行消毒，防止 XSS 攻击
 * @param html 原始 HTML 内容
 * @returns 消毒后的安全 HTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * 创建一个计算属性适用的 sanitize 函数
 * 用于在模板中直接使用
 */
export function useSanitize() {
  return { sanitizeHtml };
}
