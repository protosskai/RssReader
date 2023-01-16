<template>
  <div>
    <p>{{ title }}</p>
    <ul>
      <li v-for="todo in todos" :key="todo.id" @click="increment">
        {{ todo.id }} - {{ todo.content }}
      </li>
    </ul>
    <p>Count: {{ todoCount }} / {{ meta.totalCount }}</p>
    <p>Active: {{ active ? 'yes' : 'no' }}</p>
    <p>Clicks on todos: {{ clickCount }}</p>
    <div>
      <q-btn
        @click="$q.notify('My message')"
        color="primary"
        label="Show a notification"
      />

      <q-btn
        @click="showNotification"
        color="primary"
        label="Show another notification"
      />
    </div>
    <q-icon name="cloud" />
    <div class="row">
      <!--
        more than 12 grid points together,
        so second <div> will wrap on next line
      -->
      <div class="col-8">col</div>
      <div class="col-8">col</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import {Todo, Meta} from './models';
import {useQuasar} from 'quasar'

interface Props {
  title: string;
  todos?: Todo[];
  meta: Meta;
  active: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  todos: () => [],
});

const clickCount = ref(0);

function increment() {
  clickCount.value += 1;
  return clickCount.value;
}

const todoCount = computed(() => props.todos.length);
const $q = useQuasar()
const showNotification = () => {
  $q.notify('Some other message')
}

</script>
