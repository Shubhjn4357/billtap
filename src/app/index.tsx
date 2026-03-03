import { Redirect } from 'expo-router';
import { useBusiness, useIsAuthenticated } from '../store/authStore';

export default function Index() {
  const isAuthenticated = useIsAuthenticated();
  const business = useBusiness();

  const nextRoute = !isAuthenticated
    ? '/(auth)/login'
    : business?.id
      ? '/(main)'
      : '/(auth)/business-select';

  return <Redirect href={nextRoute} />;
}
