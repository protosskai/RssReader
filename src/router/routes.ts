import {RouteRecordRaw} from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('pages/Content.vue')
      },
      {
        path: '/postList/:RssId',
        name: 'PostList',
        component: () => import('pages/PostList.vue')
      },
      {
        path: '/content/:RssId/:PostId',
        name: 'Content',
        component: () => import('pages/Content.vue')
      },
      {
        path: '/setting',
        name: 'Setting',
        component: () => import('pages/SettingPage.vue')
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
