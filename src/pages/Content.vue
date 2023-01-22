<template>
  <q-page class="content-page row items-center justify-evenly">
    <q-item v-if="curContentInfo" v-html="curContentInfo.content" class="content-area">
    </q-item>
  </q-page>
</template>
<script setup lang="ts">
import {useRoute} from "vue-router";
import {ContentInfo} from "src/common/ContentInfo";
import {onMounted, ref, Ref} from "vue";

const route = useRoute();
const {RssId, PostId} = route.params
const curContentInfo: Ref<ContentInfo | null> = ref(null);
const getContentById = async (rssId: number, postId: number): Promise<ContentInfo> => {
  // const contentInfo: ContentInfo = {
  //   title: '声网许振明：RTC 场景 UHD 视频应用和探索',
  //   content: `<div class="content"> <p style="margin-left:0; margin-right:0"><span><strong>2023年1月13日，2022 年度OSC中国开源项目评选 ——「2022 中国开源社区健康案例」获奖社区正式揭晓！</strong></span></p> <p style="margin-left:0; margin-right:0"><span><strong>《2022 年度 OSC 中国开源项目评选》是由国内领先的中文开源技术社区OSCHINA（开源中国）主办的活动，旨在更好地展示国内开源现状，探讨国内开源趋势，激励国内开源人才，促进国内开源生态完善。</strong></span></p> <p style="margin-left:0; margin-right:0"><span><strong><span>openKylin（开放麒麟）作为中国桌面操作系统根社区，凭借在</span><span style="color:#d35400">社区技术迭代、组织架构、成员构成、开源治理、上下游协作、社区生态、商业化</span><span>等方面的多样性与管理、运作能力，入选「2022 中国开源社区健康案例」。</span></strong></span></p> <div style="text-align:center"> <img src="https://www.openkylin.top/upload/202301/1673938518583912.png" referrerpolicy="no-referrer"> </div> <p style="margin-left:0; margin-right:0"><span><span>致力于推动开源社区建设，openKylin自2022年6月成立以来，便受到社会的广泛关注，吸引了大量企业、组织和开发者加入，快速聚集行业中坚力量，共同推动操作系统技术创新和生态共建。截至目前，openKylin社区单位会员已突破</span><strong><span>140</span></strong><span>家，社区用户数量超26万，社区贡献者近</span><strong><span>2000</span></strong><span>人，并成立</span><strong><span>57</span></strong><span>个社区SIG组开展各类技术研究和创新。</span></span></p> <p style="margin-left:0; margin-right:0"><span>此番获奖不仅是openKylin社区的荣誉，也是全体社区成员的共同荣誉，是大家共同努力的结果，促使openKylin社区蓬勃发展。未来，openKylin社区也将保持初心，为构建良好开源生态发展持续努力。</span></p> <p style="margin-left:0; margin-right:0; text-align:center"><img src="https://www.openkylin.top/upload/202301/1673938528148387.png" referrerpolicy="no-referrer"></p> <p style="margin-left:0; margin-right:0"><span>openKylin（开放麒麟）社区旨在以“共创”为核心，在开源、自愿、平等、协作的基础上，通过开源、开放的方式与企业构建合作伙伴生态体系，共同打造桌面操作系统顶级社区，推动Linux开源技术及其软硬件生态繁荣发展。</span></p> <p style="margin-left:0; margin-right:0"><span>社区首批理事成员单位包括麒麟软件、普华基础软件、中科方德、麒麟信安、凝思软件、一铭软件、中兴新支点、元心科技、中国电科32所、技德系统、北京麟卓、先进操作系统创新中心等13家产业同仁和行业机构。</span></p> <p style="margin-left:0; margin-right:0">&nbsp;</p> <p style="margin-left:0; margin-right:0">&nbsp;</p> <p style="margin-left:0; margin-right:0"><span><span style="color:#888888">来源：openKylin</span></span></p> <p style="margin-left:0; margin-right:0"><span><span style="color:#888888">审核：openKylin</span></span></p> </div>`,
  //   author: 'protosskai',
  //   updateTime: '2022-1-1'
  // }
  // return contentInfo
  return window.electronAPI.getPostContent(rssId, postId)
}
onMounted(async () => {
  const result = await getContentById(Number(RssId), Number(PostId))
  curContentInfo.value = result
})

</script>

<style scoped lang="scss">
.content-page {
  padding-left: 25px;
  padding-right: 25px;
}

.content-area {
  font-size: 16px;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: start;
}
</style>
