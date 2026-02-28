import { Redirect } from 'expo-router';
import { useIsAuthenticated } from '../store/authStore';

export default function Index() {
  const isAuthenticated = useIsAuthenticated();
  return <Redirect href={isAuthenticated ? '/(main)' : '/(auth)/login'} />;
}
