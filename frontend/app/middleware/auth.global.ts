import { useAuth } from '../features/auth/composables/useAuth';

export default defineNuxtRouteMiddleware(async to => {
  if (to.path !== '/admin' && !to.path.startsWith('/admin/') && to.path !== '/login') return;
  const auth = useAuth();
  const authenticated = auth.isAuthenticated() || await auth.restoreSession();
  if (to.path === '/login') {
    if (authenticated) return navigateTo('/admin');
  } else if (!authenticated) return navigateTo('/login');
});
