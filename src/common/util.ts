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
