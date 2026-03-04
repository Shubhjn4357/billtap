import { Redirect } from 'expo-router';
import { useBusiness, useIsAuthenticated, useIsBootstrapped } from '../store/authStore';

export default function Index() {
  const isAuthenticated = useIsAuthenticated();
  const isBootstrapped = useIsBootstrapped();
  const business = useBusiness();

  if (!isBootstrapped) {
    return null;
  }

  const nextRoute = !isAuthenticated
    ? '/(auth)/login'
    : business?.id
      ? '/(main)'
      : '/(auth)/business-select';

  return <Redirect href={nextRoute} />;
}
