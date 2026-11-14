import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const CREATIVE_ICON = require('../../assets/images/creative-5.webp');
const NOISE_TEXTURE = require('../../assets/images/noise.png');

interface ElevenLabsVoiceOrbProps {
  size?: number;
  isListening?: boolean;
  showModalCircleRings?: boolean;
  style?: ViewStyle;
}

export const ElevenLabsVoiceOrb: React.FC<ElevenLabsVoiceOrbProps> = ({
  size = 56,
  isListening = true,
  showModalCircleRings = false,
  style,
}) => {
  // Horizontal wave fluid motion animation (left to right, right to left)
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Concentric circle animations for modal mode (like 11labs voice agent soundwave aura rings)
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;
    const duration = isListening ? 3800 : 6000;

    // Smooth horizontal sway from left to right, then smoothly back from right to left
    const runWave = () => {
      if (isCancelled) return;
      Animated.sequence([
        // Left to right
        Animated.timing(waveAnim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        // Right to left
        Animated.timing(waveAnim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !isCancelled) {
          runWave();
        }
      });
    };

    runWave();

    // Modal concentric circular waves
    let ringLoop1: Animated.CompositeAnimation | null = null;
    let ringLoop2: Animated.CompositeAnimation | null = null;
    let ringLoop3: Animated.CompositeAnimation | null = null;

    if (showModalCircleRings) {
      ringAnim1.setValue(0);
      ringAnim2.setValue(0);
      ringAnim3.setValue(0);

      ringLoop1 = Animated.loop(
        Animated.timing(ringAnim1, {
          toValue: 1,
          duration: 3200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        { resetBeforeIteration: true }
      );

      ringLoop2 = Animated.loop(
        Animated.sequence([
          Animated.delay(1050),
          Animated.timing(ringAnim2, {
            toValue: 1,
            duration: 3200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );

      ringLoop3 = Animated.loop(
        Animated.sequence([
          Animated.delay(2100),
          Animated.timing(ringAnim3, {
            toValue: 1,
            duration: 3200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );

      ringLoop1.start();
      ringLoop2.start();
      ringLoop3.start();
    }

    return () => {
      isCancelled = true;
      waveAnim.stopAnimation();
      if (ringLoop1) ringLoop1.stop();
      if (ringLoop2) ringLoop2.stop();
      if (ringLoop3) ringLoop3.stop();
    };
  }, [isListening, showModalCircleRings]);

  // Gentle horizontal sway (left to right, right to left)
  const flowX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, 7], // flows from left (-7px) to right (+7px)
  });

  const counterFlowX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [7, -7], // counter-flows from right (+7px) to left (-7px)
  });

  const flowY = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -1.5, 0], // subtle breathing rise in the center
  });

  const tilt = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-6deg', '6deg'], // organic tilt with wave
  });

  const counterTilt = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['6deg', '-6deg'],
  });

  // Modal animated rings interpolations
  const ring1Scale = ringAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.48],
  });
  const ring1Opacity = ringAnim1.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.65, 0.4, 0],
  });

  const ring2Scale = ringAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.48],
  });
  const ring2Opacity = ringAnim2.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.65, 0.4, 0],
  });

  const ring3Scale = ringAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.48],
  });
  const ring3Opacity = ringAnim3.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.65, 0.4, 0],
  });

  // Calculate inner image dimensions scaled to cover the entire circle area completely without gaps
  const imageCoverSize = Math.round(size * 1.42);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Modal Ambient Concentric Circle Animations */}
      {showModalCircleRings && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.modalRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: '#C084FC',
                transform: [{ scale: ring1Scale }],
                opacity: ring1Opacity,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.modalRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: '#048256',
                transform: [{ scale: ring2Scale }],
                opacity: ring2Opacity,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.modalRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: '#38BDF8',
                transform: [{ scale: ring3Scale }],
                opacity: ring3Opacity,
              },
            ]}
          />
        </>
      )}

      {/* Main Core Orb - Fixed stable size, no growing or shrinking */}
      <View
        style={[
          styles.coreContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {/* Layer 1: Clockwise dynamic gradient fluid mesh */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.gradientMeshLayer,
            {
              width: size * 1.6,
              height: size * 1.6,
              transform: [{ translateX: flowX }, { rotate: tilt }],
            },
          ]}
        >
          <LinearGradient
            colors={['#C084FC', '#F472B6', '#38BDF8', '#818CF8', '#E879F9', '#A7F3D0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Layer 2: Counter-drifting secondary gradient */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.gradientMeshLayer,
            {
              width: size * 1.6,
              height: size * 1.6,
              opacity: 0.65,
              transform: [{ translateX: counterFlowX }, { rotate: counterTilt }],
            },
          ]}
        >
          <LinearGradient
            colors={['#A855F7', '#EC4899', '#60A5FA', '#34D399', '#C084FC']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Layer 3: creative-5.webp with slow fluid sway left to right and right to left */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: imageCoverSize,
            height: imageCoverSize,
            transform: [
              { translateX: flowX },
              { translateY: flowY },
              { rotate: tilt },
            ],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={CREATIVE_ICON}
            style={{
              width: imageCoverSize,
              height: imageCoverSize,
            }}
            contentFit="cover"
            priority="high"
          />
        </Animated.View>

        {/* Layer 4: Subtle translucent liquid sheen overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.gradientMeshLayer,
            {
              width: size * 1.5,
              height: size * 1.5,
              opacity: 0.2,
              transform: [{ translateX: counterFlowX }, { rotate: counterTilt }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(192, 132, 252, 0.2)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Layer 5: Film grain / noise texture overlay with dynamic micro-shimmer */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.gradientMeshLayer,
            {
              width: size * 1.5,
              height: size * 1.5,
              opacity: 0.16,
              transform: [{ translateX: counterFlowX }, { rotate: counterTilt }],
            },
          ]}
        >
          <Image
            source={NOISE_TEXTURE}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  coreContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  gradientMeshLayer: {
    position: 'absolute',
  },
  modalRing: {
    position: 'absolute',
    borderWidth: 2,
  },
});
