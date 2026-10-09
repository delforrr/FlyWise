import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import type { ZodObject, ZodRawShape } from "zod";
import LoginForm from "~/features/auth/components/LoginForm.vue";

const UAuthFormStub = {
  name: "UAuthForm",
  props: ["schema", "fields", "validateOn", "title", "icon", "submit"],
  emits: ["submit"],
  template: `
    <form class="u-auth-form" @submit.prevent="$emit('submit', submitPayload)">
      <h2 class="u-auth-title">{{ title }}</h2>
      <slot name="description" />
      <slot name="password-hint" />
      <slot name="validation" />
      <slot name="footer" />
    </form>
  `,
  data() {
    return {
      submitPayload: {
        data: {
          email: "admin@flywise.aero",
          password: "Password123!",
          remember: true,
        },
      },
    };
  },
};

const UAlertStub = {
  name: "UAlert",
  props: ["color", "icon", "title", "description"],
  template: `
    <div role="alert" class="u-alert" :data-color="color" :data-icon="icon">
      <strong class="u-alert-title">{{ title }}</strong>
      <p class="u-alert-desc">{{ description }}</p>
    </div>
  `,
};

const PaperBezelStub = {
  name: "PaperBezel",
  template: '<div class="paper-bezel-stub"><slot /></div>',
};

const ULinkStub = {
  name: "ULink",
  props: ["to"],
  template: '<a class="u-link-stub" :href="to"><slot /></a>',
};

describe("LoginForm.vue — Suite de Pruebas Unitarias del Módulo de Autenticación", () => {
  let mockNavigateTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigateTo = vi.fn();
    // Simular el helper global de navegación de Nuxt
    vi.stubGlobal("navigateTo", mockNavigateTo);
  });

  const mountLoginForm = (props = {}) => {
    return mount(LoginForm, {
      props,
      global: {
        stubs: {
          UAuthForm: UAuthFormStub,
          UAlert: UAlertStub,
          PaperBezel: PaperBezelStub,
          ULink: ULinkStub,
        },
      },
    });
  };

  describe("Configuración e inicialización del formulario", () => {
    it("renderiza la estructura base con título administrativo y botón de submit", () => {
      const wrapper = mountLoginForm();
      const authForm = wrapper.findComponent(UAuthFormStub);

      expect(authForm.exists()).toBe(true);
      expect(authForm.props("title")).toBe("Acceso Restringido");
      expect(authForm.props("icon")).toBe("i-lucide-shield-lock");

      const submitConfig = authForm.props("submit");
      expect(submitConfig).toBeDefined();
      expect(submitConfig.label).toBe("Autenticarse");
      expect(submitConfig.variant).toBe("subtle");
    });

    it("declara los campos requeridos (email, password, remember) con sus configuraciones de UI", () => {
      const wrapper = mountLoginForm();
      const authForm = wrapper.findComponent(UAuthFormStub);
      const fields = authForm.props("fields");

      expect(fields).toHaveLength(3);

      const emailField = fields.find(
        (f: { name: string }) => f.name === "email",
      );
      expect(emailField).toBeDefined();
      expect(emailField.type).toBe("email");
      expect(emailField.required).toBe(true);
      expect(emailField.placeholder).toBe("admin@flywise.aero");

      const passwordField = fields.find(
        (f: { name: string }) => f.name === "password",
      );
      expect(passwordField).toBeDefined();
      expect(passwordField.type).toBe("password");
      expect(passwordField.required).toBe(true);

      const rememberField = fields.find(
        (f: { name: string }) => f.name === "remember",
      );
      expect(rememberField).toBeDefined();
      expect(rememberField.type).toBe("checkbox");
      expect(rememberField.defaultValue).toBe(false);
    });

    it("renderiza el slot de descripción con el texto informativo institucional", () => {
      const wrapper = mountLoginForm();
      expect(wrapper.text()).toContain(
        "Acceso exclusivo para administradores y auditores de telemetría de FlyWise.",
      );
    });

    it("renderiza el enlace de recuperación de contraseña y el de regreso al inicio", () => {
      const wrapper = mountLoginForm();
      const links = wrapper.findAllComponents(ULinkStub);

      expect(links.length).toBeGreaterThanOrEqual(2);

      const forgotPasswordLink = links.find((l) =>
        l.text().includes("¿Olvidaste tu contraseña?"),
      );
      expect(forgotPasswordLink?.exists()).toBe(true);

      const homeLink = links.find((l) => l.props("to") === "/");
      expect(homeLink?.exists()).toBe(true);
      expect(homeLink?.text()).toContain("Bienvenida");
    });
  });

  describe("Validación del esquema Zod (:schema)", () => {
    let schema: ZodObject<ZodRawShape>;

    beforeEach(() => {
      const wrapper = mountLoginForm();
      schema = wrapper.findComponent(UAuthFormStub).props("schema");
    });

    it("acepta credenciales administrativas válidas", () => {
      const validPayload = {
        email: "ops.lead@flywise.aero",
        password: "ValidPassword2026",
        remember: true,
      };

      const result = schema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe(validPayload.email);
        expect(result.data.remember).toBe(true);
      }
    });

    it("rechaza correos electrónicos con formato inválido", () => {
      const invalidEmailPayload = {
        email: "correo-invalido-sin-arroba",
        password: "ValidPassword2026",
      };

      const result = schema.safeParse(invalidEmailPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailIssue = result.error.issues.find((i) =>
          i.path.includes("email"),
        );
        expect(emailIssue).toBeDefined();
        expect(emailIssue?.message).toBe(
          "Formato de correo electrónico inválido",
        );
      }
    });

    it("rechaza contraseñas vacías con el mensaje correspondiente", () => {
      const emptyPasswordPayload = {
        email: "admin@flywise.aero",
        password: "",
      };

      const result = schema.safeParse(emptyPasswordPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordIssues = result.error.issues.filter((i) =>
          i.path.includes("password"),
        );
        expect(passwordIssues.length).toBeGreaterThan(0);
        expect(
          passwordIssues.some(
            (i) => i.message === "La contraseña es requerida",
          ),
        ).toBe(true);
      }
    });

    it("rechaza contraseñas con longitud menor a 8 caracteres", () => {
      const shortPasswordPayload = {
        email: "admin@flywise.aero",
        password: "1234567", // 7 caracteres
      };

      const result = schema.safeParse(shortPasswordPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const lengthIssue = result.error.issues.find((i) =>
          i.path.includes("password"),
        );
        expect(lengthIssue?.message).toBe(
          "La contraseña debe tener al menos 8 caracteres",
        );
      }
    });

    it("permite omitir el campo remember ya que es opcional", () => {
      const payloadWithoutRemember = {
        email: "admin@flywise.aero",
        password: "PasswordSegura2026",
      };

      const result = schema.safeParse(payloadWithoutRemember);
      expect(result.success).toBe(true);
    });
  });

  describe("Manejo de errores y alertas visuales (props.hasError)", () => {
    it("no renderiza la alerta UAlert cuando hasError es false por defecto", () => {
      const wrapper = mountLoginForm({ hasError: false });
      const alert = wrapper.findComponent(UAlertStub);

      expect(alert.exists()).toBe(false);
    });

    it("renderiza la alerta UAlert con rol accesible y estilos de error cuando hasError es true", () => {
      const wrapper = mountLoginForm({ hasError: true });
      const alert = wrapper.findComponent(UAlertStub);

      expect(alert.exists()).toBe(true);
      expect(alert.props("color")).toBe("error");
      expect(alert.props("icon")).toBe("i-lucide-alert-triangle");
      expect(alert.props("title")).toBe("Error de Autenticación");
      expect(alert.props("description")).toBe(
        "Las credenciales ingresadas son incorrectas o no cuentan con privilegios administrativos.",
      );

      // Verificación de render en el DOM simulado
      const alertDom = wrapper.find('[role="alert"]');
      expect(alertDom.exists()).toBe(true);
      expect(alertDom.text()).toContain("Error de Autenticación");
    });

    it("reacciona dinámicamente si hasError cambia reactivamente", async () => {
      const wrapper = mountLoginForm({ hasError: false });
      expect(wrapper.findComponent(UAlertStub).exists()).toBe(false);

      await wrapper.setProps({ hasError: true });
      expect(wrapper.findComponent(UAlertStub).exists()).toBe(true);

      await wrapper.setProps({ hasError: false });
      expect(wrapper.findComponent(UAlertStub).exists()).toBe(false);
    });
  });

  describe("Envío del formulario (submit) y redirección", () => {
    it('ejecuta navigateTo("/admin") cuando se dispara el evento submit de UAuthForm', async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const wrapper = mountLoginForm();
      const authForm = wrapper.findComponent(UAuthFormStub);

      const submissionPayload = {
        data: {
          email: "admin@flywise.aero",
          password: "SuperSecurePassword!",
          remember: true,
        },
      };

      // Disparar el evento de submit desde el formulario hijo
      await authForm.vm.$emit("submit", submissionPayload);

      // Aserciones:
      expect(consoleSpy).toHaveBeenCalledWith(
        "Submitted login credentials:",
        submissionPayload,
      );
      expect(mockNavigateTo).toHaveBeenCalledTimes(1);
      expect(mockNavigateTo).toHaveBeenCalledWith("/admin");

      consoleSpy.mockRestore();
    });
  });
});
