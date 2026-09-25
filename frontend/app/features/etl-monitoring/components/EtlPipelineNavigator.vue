<script setup lang="ts">
import { computed } from "vue";
import type { TabsItem } from "@nuxt/ui";

export interface NavigatorItem extends TabsItem {
  count?: number | string;
}

const props = defineProps<{
  items: (string | NavigatorItem)[];
}>();

const modelValue = defineModel<string | number>();

const normalizedItems = computed<NavigatorItem[]>(() =>
  props.items.map((item) =>
    typeof item === "string" ? { label: item, value: item } : item,
  ),
);

const ui = {
  root: "w-fit",
  list: "p-1 rounded-lg border border-border-subtle bg-surface-card text-xs font-semibold inline-flex w-fit",
  indicator: "bg-primary rounded-md shadow-xs",
  trigger: [
    "px-3 py-1.5 rounded-md cursor-pointer text-xs font-semibold transition-colors gap-1",
    "text-text-muted hover:text-text-main",
    "data-[state=active]:text-on-primary data-[state=active]:font-bold",
    "in-[[data-slot=list]:not(:has([data-slot=indicator]))]:data-[state=active]:before:bg-primary",
  ],
};
</script>

<template>
  <UTabs
    v-model="modelValue"
    :items="normalizedItems"
    color="primary"
    variant="pill"
    size="sm"
    :ui="ui"
  >
    <template #trailing="{ item }">
      <span v-if="item.count !== undefined || item.badge !== undefined">
        ({{ item.count ?? item.badge }})
      </span>
    </template>
  </UTabs>
</template>
