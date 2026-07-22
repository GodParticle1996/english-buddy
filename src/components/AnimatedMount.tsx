// Fades + slides its children up on mount. Use a `delay` to stagger siblings
// for a cascade effect. Re-runs whenever its React `key` changes.
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

type Props = {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedMount({
  children,
  delay = 0,
  offset = 14,
  duration = 380,
  style,
}: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });

  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
