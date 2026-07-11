import {RouteRecordRaw} from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('pages/HomePage.vue')
      },
      {
        path: '/postList/:RssId',
        name: 'PostList',
        component: () => import('pages/PostList.vue')
      },
      {
        // Use query params for article id — guids are often full URLs with / ? &
        // e.g. https://news.ycombinator.com/item?id=123 which break path segments
        path: '/content',
        name: 'Content',
        component: () => import('pages/Content.vue')
      },
      // Legacy path support (redirect to query form)
      {
        path: '/content/:RssId/:PostId(.*)',
        redirect: (to) => ({
          name: 'Content',
          query: {
            rssId: String(to.params.RssId || ''),
            postId: String(to.params.PostId || ''),
          },
        }),
      },
      {
        path: '/setting',
        name: 'Setting',
        component: () => import('pages/SettingPage.vue')
      },
      {
        path: '/favorite',
        name: 'Favorite',
        component: () => import('pages/FavoritePage.vue')
      }
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
