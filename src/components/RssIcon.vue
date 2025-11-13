<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  src: string,
  title: string
}>()

const imageLoadError = ref(false)

const generateIconDesc = () => {
  if (props.title === '') {
    return 'RSS'
  }
  return props.title[0].toUpperCase()
}

const onImageError = () => {
  imageLoadError.value = true
}
</script>

<template>
  <div>
    <div v-if="src === '' || imageLoadError" class="blank">
      <span class="content">
       {{ generateIconDesc() }}
      </span>
    </div>
    <q-img v-else :src="src" @error="onImageError">
      <template v-slot:error>
        <div class="blank">
          <span class="content">
            {{ generateIconDesc() }}
          </span>
        </div>
      </template>
    </q-img>
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
