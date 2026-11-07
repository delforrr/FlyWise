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
      USelect: { props: ['modelValue', 'items'], emits: ['update:modelValue'], template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :value="item.value">{{ item.label }}</option></select>' },
      UButton: true, UKbd: true, ThemeToggle: true, CommandPalette: true,
    } },
  });
  const wrapper = render();
  const selector = wrapper.get('select[aria-label="Idioma de países y mapa"]');
  expect((selector.element as HTMLSelectElement).value).toBe('es');
  await selector.setValue('en');
  expect(cookie.value).toBe('en');
  wrapper.unmount();
  const again = render();
  expect((again.get('select').element as HTMLSelectElement).value).toBe('en');
  again.unmount();
});
