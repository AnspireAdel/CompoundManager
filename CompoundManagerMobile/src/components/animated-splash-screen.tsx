import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, StatusBar, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
}

export function AnimatedSplashScreen({ isReady, onFinish }: AnimatedSplashScreenProps) {
  // Shared values for entrance and exit animations
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const logoTranslateY = useSharedValue(20);

  const bgScale = useSharedValue(1.06);
  const bgOpacity = useSharedValue(0);

  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  useEffect(() => {
    // Hide the native OS splash screen immediately so our animated screen takes over seamlessly
    SplashScreen.hideAsync().catch(() => {});

    // 1. Entrance animation: Background fades in with subtle zoom out
    bgOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    bgScale.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });

    // 2. Entrance animation: Logo spring entrance with slight delay
    logoOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
    logoScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 14,
        stiffness: 90,
        mass: 0.9,
      })
    );
    logoTranslateY.value = withDelay(
      200,
      withSpring(0, {
        damping: 14,
        stiffness: 90,
        mass: 0.9,
      })
    );
  }, []);

  // When app resources & auth are ready, trigger smooth exit animation
  useEffect(() => {
    if (!isReady) return;

    // Smooth exit transition
    const exitTimer = setTimeout(() => {
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
    }, 150);

    return () => clearTimeout(exitTimer);
  }, [isReady]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }, { scale: logoScale.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgScale.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedContainerStyle, { pointerEvents: isReady ? 'none' : 'auto' }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#D8EAFB" translucent />

      {/* Building Background Image */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedBgStyle]}>
        <Image
          source={require('@/assets/images/splash-screen.jpg')}
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

      {/* Animated Centered Logo & Arabic Branding */}
      <View style={styles.logoWrapper}>
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </Animated.View>
      </View>
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
  logoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: SCREEN_HEIGHT * 0.23, // Matches Figma screen positioning
  },
  logoContainer: {
    width: SCREEN_WIDTH * 0.46,
    height: SCREEN_WIDTH * 0.62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
