<template>
  <q-page class="row items-center justify-evenly">
    <q-list class="row items-center justify-evenly">
      <post-list-item v-for="(item,index) in PostInfoList" :post-info="item" :key="index"/>
    </q-list>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";
import {PostInfoItem} from "src/common/PostInfoItem";
import {Ref, ref} from "vue";
import PostListItem from "src/components/PostListItem.vue";

const route = useRoute();
const {RssId} = route.params
const PostInfoList: Ref<PostInfoItem[]> = ref([
  {
    postId: 1,
    title: 'GitHub Actions 自动部署前端 Vue 项目',
    desc: '作为前端技术人员，如果要部署一个项目大体要经过：代码开发、代码推送、打包dist文件、scp到服务器、服务器nginx配置、完成部署这几个流程，现实中我们希望项目部署尽可能自动且简单，因作为前端技术人员，如果要部署一个项目大体要经过：代码开发、代码推送、打包dist文件、scp到服务器、服务器nginx配置、完成部署这几个流程，现实中我们希望项目部署尽可能自动且简单，因作为前端技术人员，如果要部署一个项目大体要经过：代码开发、代码推送、打包dist文件、scp到服务器、服务器nginx配置、完成部署这几个流程，现实中我们希望项目部署尽可能自动且简单，因作为前端技术人员，如果要部署一个项目大体要经过：代码开发、代码推送、打包dist文件、scp到服务器、服务器nginx配置、完成部署这几个流程，现实中我们希望项目部署尽可能自动且简单，因',
    author: 'protosskai',
    updateTime: '2022-01-01'
  },
  {
    postId: 2,
    title: '声网许振明：RTC 场景 UHD 视频应用和探索',
    desc: '大家好，我是声网的视频工程师许振明，今天跟大家主要介绍一下声网在 RTC 场景 UHD 视频的应用和探索。主要基于声网 HFR 和 VDR 两个',
    author: 'protosskai',
    updateTime: '2022-01-01'
  },
  {
    postId: 3,
    title: '前端也要懂设计 - 交互设计',
    desc: '费茨法则 是一个人机交互以及人体工程学中人类活动的模型，它预测了快速移动到目标区域所需的时间是目标区域的距离和目标区域的大小的函数。费茨法则多用于表现 指、点 这个动作的概念模型，',
    author: 'protosskai',
    updateTime: '2022-01-01'
  },
  {
    postId: 4,
    title: '关于浏览器的一个逆天bug',
    desc: 'bug是我在做一个二次元项目（vue+vite+mysql）的时候，最开始都没有问题，但是后来有一天我的这个项目打开控制台后出现了资源无法加载的问题，包括图片，组件等',
    author: 'protosskai',
    updateTime: '2022-01-01'
  },
]);

</script>
