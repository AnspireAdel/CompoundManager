import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPLASH_DURATION_MS = 3000;

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
}

export function AnimatedSplashScreen({ isReady, onFinish }: AnimatedSplashScreenProps) {
  const bgScale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    // Native splash already shows the same artwork. Hide it on the first frame
    // so there is no white placeholder, then keep this screen fully visible.
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });

    // Subtle continuous "breathing" zoom on the background art while we wait.
    // Starts at scale 1 (matching the native splash frame exactly, so there's
    // no visible jump at the handoff above) and gently oscillates from there.
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  // Stay on splash for at least 3s, then fade out once the app is ready
  useEffect(() => {
    if (!isReady) return;

    const remaining = Math.max(0, SPLASH_DURATION_MS - (Date.now() - startedAtRef.current));
    const exitTimer = setTimeout(() => {
      cancelAnimation(bgScale);
      bgScale.value = withTiming(1, { duration: 200 });

      containerScale.value = withTiming(1.04, {
        duration: 450,
        easing: Easing.inOut(Easing.cubic),
      });

      containerOpacity.value = withTiming(
        0,
        {
          duration: 450,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished && onFinish) {
            runOnJS(onFinish)();
          }
        }
      );
    }, remaining);

    return () => clearTimeout(exitTimer);
  }, [isReady]);

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgScale.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor="#D8EAFB" translucent />

      {/* Building Background Image */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedBgStyle]}>
        <Image
          source={require('@/assets/images/splash-screen.png')}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      </Animated.View>

      {/* Code-Generated Sky Blue Gradient from Top */}
      <LinearGradient
        colors={[
          'rgba(214, 234, 251, 0.95)',
          'rgba(224, 240, 253, 0.85)',
          'rgba(235, 245, 255, 0.55)',
          'rgba(240, 246, 252, 0.20)',
          'transparent',
        ]}
        locations={[0, 0.15, 0.32, 0.48, 0.65]}
        style={styles.gradientOverlay}
      />

      {/* Subtle Mist Gradient over the buildings */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.10)', 'transparent']}
        locations={[0.25, 0.45, 0.65]}
        style={styles.mistOverlay}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: '#D8EAFB',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.7,
  },
  mistOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
