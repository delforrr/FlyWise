import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OtpBadge from "../../app/shared/components/hud/OtpBadge.vue";

const UBadgeStub = {
  name: "UBadge",
  props: ["color", "variant", "size", "role", "ariaLabel"],
  template: '<span class="u-badge-stub" :data-color="color" :role="role" :aria-label="ariaLabel"><slot /></span>',
};

const UIconStub = {
  name: "UIcon",
  props: ["name"],
  template: '<i class="u-icon-stub" :data-icon="name" />',
};

describe("OtpBadge.vue — Indicador Táctico de Puntualidad OTP-15", () => {
  const mountBadge = (props = {}) => {
    return mount(OtpBadge, {
      props,
      global: {
        stubs: {
          UBadge: UBadgeStub,
          UIcon: UIconStub,
        },
      },
    });
  };

  describe("Clasificación de Umbrales RNF-02 (Alta > 85%, Media 60-85%, Baja < 60%)", () => {
    it("asigna nivel 'Alta', color 'success' e icono de escudo para valores > 85%", () => {
      const wrapper = mountBadge({ value: 91.4 });

      expect(wrapper.text()).toContain("Alta");
      expect(wrapper.text()).toContain("91.4% OTP-15");

      const badge = wrapper.findComponent(UBadgeStub);
      expect(badge.props("color")).toBe("success");

      const icon = wrapper.findComponent(UIconStub);
      expect(icon.props("name")).toBe("i-lucide-shield-check");

      const dot = wrapper.find(".bg-success");
      expect(dot.exists()).toBe(true);
    });

    it("asigna nivel 'Media', color 'warning' e icono de advertencia para valores entre 60% y 84.9%", () => {
      const wrapper = mountBadge({ value: 72.8 });

      expect(wrapper.text()).toContain("Media");
      expect(wrapper.text()).toContain("72.8% OTP-15");

      const badge = wrapper.findComponent(UBadgeStub);
      expect(badge.props("color")).toBe("warning");

      const icon = wrapper.findComponent(UIconStub);
      expect(icon.props("name")).toBe("i-lucide-alert-triangle");

      const dot = wrapper.find(".bg-warning");
      expect(dot.exists()).toBe(true);
    });

    it("asigna nivel 'Baja', color 'error' e icono de reloj de alerta para valores < 60%", () => {
      const wrapper = mountBadge({ value: 48.2 });

      expect(wrapper.text()).toContain("Baja");
      expect(wrapper.text()).toContain("48.2% OTP-15");

      const badge = wrapper.findComponent(UBadgeStub);
      expect(badge.props("color")).toBe("error");

      const icon = wrapper.findComponent(UIconStub);
      expect(icon.props("name")).toBe("i-lucide-clock-alert");

      const dot = wrapper.find(".bg-error");
      expect(dot.exists()).toBe(true);
    });

    it("evalúa exactamente los límites de frontera (85.0%, 84.9%, 60.0%, 59.9%)", () => {
      const at85 = mountBadge({ value: 85.0 });
      expect(at85.findComponent(UBadgeStub).props("color")).toBe("warning");

      const at849 = mountBadge({ value: 84.9 });
      expect(at849.findComponent(UBadgeStub).props("color")).toBe("warning");

      const at60 = mountBadge({ value: 60.0 });
      expect(at60.findComponent(UBadgeStub).props("color")).toBe("warning");

      const at599 = mountBadge({ value: 59.9 });
      expect(at599.findComponent(UBadgeStub).props("color")).toBe("error");
    });
  });

  describe("Fallback descriptivo cuando value es indefinido", () => {
    it("utiliza props.message 'Alta' mostrando '> 85%'", () => {
      const wrapper = mountBadge({ message: "Alta" });
      expect(wrapper.text()).toContain("Alta");
      expect(wrapper.text()).toContain("> 85%");
      expect(wrapper.findComponent(UBadgeStub).props("color")).toBe("success");
    });

    it("utiliza props.message 'Media' mostrando '60% – 85%'", () => {
      const wrapper = mountBadge({ message: "Media" });
      expect(wrapper.text()).toContain("Media");
      expect(wrapper.text()).toContain("60% – 85%");
      expect(wrapper.findComponent(UBadgeStub).props("color")).toBe("warning");
    });

    it("utiliza props.message 'Baja' mostrando '< 60%'", () => {
      const wrapper = mountBadge({ message: "Baja" });
      expect(wrapper.text()).toContain("Baja");
      expect(wrapper.text()).toContain("< 60%");
      expect(wrapper.findComponent(UBadgeStub).props("color")).toBe("error");
    });
  });

  describe("Accesibilidad y Dual Sensory Encoding", () => {
    it("incluye role='status' y aria-label dinámico para lectores de pantalla", () => {
      const wrapper = mountBadge({ value: 88.5 });
      const badge = wrapper.findComponent(UBadgeStub);

      expect(badge.attributes("role")).toBe("status");
      expect(badge.attributes("aria-label")).toBe(
        "Confiabilidad Alta: 88.5% OTP-15",
      );
    });

    it("reacciona dinámicamente si el valor cambia reactivamente", async () => {
      const wrapper = mountBadge({ value: 90 });
      expect(wrapper.text()).toContain("Alta");

      await wrapper.setProps({ value: 55 });
      expect(wrapper.text()).toContain("Baja");
      expect(wrapper.findComponent(UBadgeStub).props("color")).toBe("error");
    });
  });
});

describe('Unknown punctuality', () => {
  it('shows a neutral badge with an accessible absence label', () => {
    const wrapper = mount(OtpBadge, { props: { value: null }, global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } } });
    expect(wrapper.text()).toContain('Sin datos');
    expect(wrapper.findComponent(UBadgeStub).props('color')).toBe('neutral');
    expect(wrapper.findComponent(UBadgeStub).props('ariaLabel')).toContain('Sin datos');
    expect(wrapper.text()).not.toContain('0.0%');
  });
});
