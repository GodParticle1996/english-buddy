// A Pressable that springs down slightly while pressed, for tactile feedback.
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export default function PressableScale({
  children,
  style,
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        spring(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        spring(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
