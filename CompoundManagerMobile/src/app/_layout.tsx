import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';

// Keep native splash visible until our animated splash component takes over
SplashScreen.preventAutoHideAsync().catch(() => {});

const PUBLIC_ROUTES = new Set(['login', 'register', 'forgot-password', 'reset-password']);

// Web only: the dev server's Fast Refresh/HMR socket (and no-cache bundle
// responses) commonly makes the page ineligible for the browser's
// back-forward cache, so a real back button/gesture can trigger a full page
// reload instead of an in-app navigation — which would otherwise reset this
// component's state and show the splash again on every back press. Remember
// "already shown" for the tab's session so a reload doesn't replay it.
const SPLASH_SHOWN_KEY = 'splash-shown';

function hasShownSplashThisSession(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSplashShownThisSession(): void {
  if (Platform.OS !== 'web') return;
  try {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
  } catch {
    // ignore (e.g. private browsing storage restrictions)
  }
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const [splashVisible, setSplashVisible] = useState(() => !hasShownSplashThisSession());

  const isReady = !loading && Boolean(navState?.key);

  useEffect(() => {
    if (!isReady) return;

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
  }, [user, isReady, segments]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {splashVisible && (
        <AnimatedSplashScreen
          isReady={isReady}
          onFinish={() => {
            setSplashVisible(false);
            markSplashShownThisSession();
          }}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="force-change-password" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="residents" />
          <Stack.Screen name="registrations" />
          <Stack.Screen name="payments" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="expenses" />
          <Stack.Screen name="services" />
          <Stack.Screen name="contact" />
          <Stack.Screen name="send-notifications" />
          <Stack.Screen name="unit-types" />
          <Stack.Screen name="service-types" />
          <Stack.Screen name="expense-types" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
