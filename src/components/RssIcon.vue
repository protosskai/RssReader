<script setup lang="ts">
const props = defineProps<{
  src: string,
  title: string
}>()
const generateIconDesc = () => {
  if (props.title === '') {
    return ''
  }
  return props.title[0]
}
</script>

<template>
  <div>
    <div v-if="src ===''" class="blank">
      <span class="content">
       {{ generateIconDesc() }}
      </span>
    </div>
    <q-img v-else :src="src"/>
  </div>
</template>

<style scoped lang="scss">
.blank {
  background: $primary;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  color: black;
}
</style>
