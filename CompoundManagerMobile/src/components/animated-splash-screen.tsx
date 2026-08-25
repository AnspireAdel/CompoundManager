import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, StatusBar, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPLASH_DURATION_MS = 3000;

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
}

export function AnimatedSplashScreen({ isReady, onFinish }: AnimatedSplashScreenProps) {
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoTranslateY = useSharedValue(0);

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
  }, []);

  // Stay on splash for at least 3s, then fade out once the app is ready
  useEffect(() => {
    if (!isReady) return;

    const remaining = Math.max(0, SPLASH_DURATION_MS - (Date.now() - startedAtRef.current));
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
    }, remaining);

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
