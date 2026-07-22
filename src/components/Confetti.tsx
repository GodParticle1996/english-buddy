// Lightweight confetti burst built on RN Animated (no native deps).
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const { width } = Dimensions.get('window');
const PALETTE = [colors.accent, colors.green, colors.yellow, colors.red, colors.bengali, colors.hindi];
const COUNT = 26;

function Piece({ index }: { index: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  const startX = (index / COUNT) * width + (Math.random() * 30 - 15);
  const drift = (Math.random() * 2 - 1) * 90;
  const size = 6 + Math.random() * 7;
  const color = PALETTE[index % PALETTE.length];
  const delay = Math.random() * 250;
  const rounded = index % 2 === 0;

  useEffect(() => {
    Animated.timing(fall, {
      toValue: 1,
      duration: 1500 + Math.random() * 900,
      delay,
      useNativeDriver: true,
    }).start();
  }, [fall, delay]);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-40, 560] });
  const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${720 + index * 12}deg`] });
  const opacity = fall.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size * 1.4,
        backgroundColor: color,
        borderRadius: rounded ? size : 2,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export default function Confetti() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}
