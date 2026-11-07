import { describe, expect, it, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import AppHeader from "../../app/shared/components/layout/AppHeader.vue";

describe("Logo de la cabecera pública", () => {
  it("conserva un único enlace al inicio dentro del enlace nativo de UHeader", () => {
    vi.stubGlobal("useGlobalMap", () => ({ isOpen: ref(false) }));
    const wrapper = shallowMount(AppHeader, {
      global: {
        stubs: {
          // UHeader envuelve el slot title en su propio enlace.
          UHeader: {
            template: '<header><a href="/"><slot name="title" /></a></header>',
          },
          NuxtLink: { template: '<a href="/"><slot /></a>' },
          CommandPalette: true,
        },
      },
    });
    expect(wrapper.findAll("a")).toHaveLength(1);
    expect(wrapper.get("a").text()).toContain("FlyWise");
    expect(wrapper.get("a").attributes("href")).toBe("/");
    wrapper.unmount();
  });
});

it('permite cambiar el idioma de países y mapa y conservarlo al volver a montar', async () => {
  const { mount } = await import('@vue/test-utils');
  const cookie = ref<string | null>(null);
  vi.stubGlobal('useCookie', () => cookie);
  vi.stubGlobal('useGlobalMap', () => ({ isOpen: ref(false) }));
  const render = () => mount(AppHeader, {
    global: { stubs: {
      UHeader: { template: '<header><slot name="right" /></header>' },
      UTabs: { props: ['modelValue', 'items'], emits: ['update:modelValue'], template: '<div><div role="tablist"><button v-for="item in items" role="tab" :aria-selected="modelValue === item.value" @click="$emit(\'update:modelValue\', item.value)">{{ item.label }}</button></div></div>' },
      UButton: true, UKbd: true, ThemeToggle: true, CommandPalette: true,
    } },
  });
  const wrapper = render();
  const english = wrapper.get('[role="tab"]:first-child');
  expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Idioma de países y mapa');
  expect(wrapper.text()).not.toContain('Países / mapa');
  expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['EN', 'ES']);
  expect(english.attributes('aria-selected')).toBe('false');
  expect(wrapper.get('[role="tab"]:last-child').attributes('aria-selected')).toBe('true');
  await english.trigger('click');
  expect(english.attributes('aria-selected')).toBe('true');
  expect(cookie.value).toBe('en');
  wrapper.unmount();
  (globalThis as unknown as { __clearStateStore: () => void }).__clearStateStore();
  const again = render();
  expect(again.get('[role="tab"]:first-child').attributes('aria-selected')).toBe('true');
  again.unmount();
});
