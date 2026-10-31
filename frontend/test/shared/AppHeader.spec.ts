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
