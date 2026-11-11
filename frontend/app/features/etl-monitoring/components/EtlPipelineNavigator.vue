<script setup lang="ts">
import { computed } from "vue";
import type { TabsItem } from "@nuxt/ui";

export interface NavigatorItem extends TabsItem {
  count?: number | string;
}

const props = defineProps<{
  items: (string | NavigatorItem)[];
  defaultValue?: string | number;
}>();

const modelValue = defineModel<string | number>();

const normalizedItems = computed<NavigatorItem[]>(() =>
  props.items.map((item) =>
    typeof item === "string" ? { label: item, value: item } : item,
  ),
);

</script>

<template>
  <UTabs
    v-model="modelValue"
    :items="normalizedItems"
    :default-value="props.defaultValue"
    color="primary"
    variant="link"
    :content="false"
    size="sm"
    class="max-w-full overflow-x-auto"
    :ui="{ trigger: 'whitespace-nowrap px-2' }"
  >
    <template #trailing="{ item }">
      <span v-if="item.count !== undefined || item.badge !== undefined">
        ({{ item.count ?? item.badge }})
      </span>
    </template>
  </UTabs>
</template>
