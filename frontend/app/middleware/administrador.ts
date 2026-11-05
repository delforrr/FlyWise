export default defineNuxtRouteMiddleware(() => {
  const { user } = useAuth();
  if (user.value?.rol !== "ADMIN") return navigateTo("/admin");
});
