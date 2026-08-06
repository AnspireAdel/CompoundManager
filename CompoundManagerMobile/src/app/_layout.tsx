import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const PUBLIC_ROUTES = new Set(['login', 'register', 'forgot-password', 'reset-password']);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (loading || !navState?.key) return;

    const first = segments[0] as string | undefined;
    const inPublic = first ? PUBLIC_ROUTES.has(first) : false;
    const onForceChange = first === 'force-change-password';
    const needsPasswordChange = Boolean(user?.mustChangePassword || user?.mustChangeUsername);

    if (!user && !inPublic && !onForceChange) {
      router.replace('/login');
      return;
    }

    if (user && needsPasswordChange && !onForceChange) {
      router.replace('/force-change-password');
      return;
    }

    if (user && !needsPasswordChange && (inPublic || onForceChange)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, navState?.key]);

  if (loading || !navState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="force-change-password" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
