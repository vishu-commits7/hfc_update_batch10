// Type declarations for React Native and ecosystem modules
// Used when analyzing or compiling React Native components in this repository

declare module "react-native" {
  import * as React from "react";

  export type StyleProp<T> =
    | T
    | false
    | null
    | undefined
    | ReadonlyArray<StyleProp<T>>
    | Array<StyleProp<T>>;

  export interface ViewStyle {
    flex?: number;
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    aspectRatio?: number | string;
    overflow?: "visible" | "hidden" | "scroll";
    backgroundColor?: string;
    borderRadius?: number;
    position?: "absolute" | "relative";
    justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
    alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
    alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
    gap?: number;
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    margin?: number;
    marginHorizontal?: number;
    marginVertical?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    borderWidth?: number;
    borderTopWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
    borderColor?: string;
    borderTopColor?: string;
    borderBottomColor?: string;
    borderLeftColor?: string;
    borderRightColor?: string;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
    top?: number | string;
    left?: number | string;
    right?: number | string;
    bottom?: number | string;
    opacity?: number;
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
  }

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessible?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    pointerEvents?: "box-none" | "none" | "box-only" | "auto";
    children?: React.ReactNode;
  }

  export interface ImageProps {
    source: { uri: string } | number;
    style?: StyleProp<ImageStyle>;
    resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
    fadeDuration?: number;
    accessibilityIgnoresInvertColors?: boolean;
    onError?: (error: any) => void;
  }

  export interface TouchableOpacityProps extends ViewProps {
    onPress?: (event: any) => void;
    activeOpacity?: number;
  }

  export interface ActivityIndicatorProps extends ViewProps {
    size?: "small" | "large" | number;
    color?: string;
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    fontFamily?: string;
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: "auto" | "left" | "right" | "center" | "justify";
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    fontVariant?: Array<"small-caps" | "oldstyle-nums" | "lining-nums" | "tabular-nums" | "proportional-nums">;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    accessible?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
  }

  export interface PressableStateCallbackType {
    pressed: boolean;
  }

  export interface PressableProps {
    onPress?: (event: any) => void;
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    accessible?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    hitSlop?: number | { top?: number; left?: number; bottom?: number; right?: number };
    disabled?: boolean;
    children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
  }

  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsVerticalScrollIndicator?: boolean;
  }

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const Image: React.FC<ImageProps>;
  export const Pressable: React.FC<PressableProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const ActivityIndicator: React.FC<ActivityIndicatorProps>;

  export namespace StyleSheet {
    export function create<T extends Record<string, ViewStyle | ImageStyle | TextStyle>>(styles: T): T;
    export const absoluteFillObject: ViewStyle;
  }

  export namespace Platform {
    export const OS: "android" | "ios" | "windows" | "macos" | "web";
    export const select: <T>(specifics: { [platform: string]: T; default?: T }) => T;
  }

  export namespace AccessibilityInfo {
    export function announceForAccessibility(announcement: string): void;
  }
}

declare module "react-native-reanimated" {
  import * as React from "react";
  import { ViewProps, ViewStyle, StyleProp } from "react-native";

  export interface SharedValue<T> {
    value: T;
  }

  export function useSharedValue<T>(init: T): SharedValue<T>;
  export function useAnimatedStyle<T extends ViewStyle>(updater: () => T, deps?: any[]): StyleProp<T>;
  export function withTiming<T>(toValue: T, config?: { duration?: number; easing?: any }, callback?: (isFinished?: boolean) => void): T;
  export function runOnJS<F extends (...args: any[]) => any>(fn: F): F;

  export namespace Easing {
    export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number;
    export function linear(t: number): number;
    export function ease(t: number): number;
  }

  export interface AnimatedViewProps extends ViewProps {
    style?: any;
  }

  export namespace Animated {
    export const View: React.FC<AnimatedViewProps>;
  }

  const defaultExport: {
    View: React.FC<AnimatedViewProps>;
  };
  export default defaultExport;
}

declare module "react-native-video" {
  import * as React from "react";
  import { StyleProp, ViewStyle } from "react-native";

  export interface OnLoadData {
    currentTime: number;
    duration: number;
    naturalSize: {
      width: number;
      height: number;
      orientation: "portrait" | "landscape";
    };
  }

  export interface LoadError {
    error: {
      code: number;
      domain: string;
      localizedDescription?: string;
    };
  }

  export interface ReactVideoProps {
    source: { uri: string } | number;
    paused?: boolean;
    repeat?: boolean;
    muted?: boolean;
    playInBackground?: boolean;
    playWhenInactive?: boolean;
    ignoreSilentSwitch?: "ignore" | "obey";
    resizeMode?: "cover" | "contain" | "stretch" | "none";
    viewType?: "textureView" | "surfaceView";
    useTextureView?: boolean;
    onLoad?: (data: OnLoadData) => void;
    onReadyForDisplay?: () => void;
    onError?: (error: LoadError) => void;
    style?: StyleProp<ViewStyle>;
  }

  export default class Video extends React.Component<ReactVideoProps> {
    seek(time: number): void;
    presentFullscreenPlayer(): void;
    dismissFullscreenPlayer(): void;
  }
}

declare module "lucide-react-native" {
  import * as React from "react";

  export interface IconProps {
    color?: string;
    size?: number;
    strokeWidth?: number;
  }

  export const RotateCw: React.FC<IconProps>;
  export const RotateCcw: React.FC<IconProps>;
  export const AlertTriangle: React.FC<IconProps>;
  export const Play: React.FC<IconProps>;
  export const Pause: React.FC<IconProps>;
  export const SkipForward: React.FC<IconProps>;
  export const CheckCircle2: React.FC<IconProps>;
  export const X: React.FC<IconProps>;
  export const Flame: React.FC<IconProps>;
  export const Volume2: React.FC<IconProps>;
  export const VolumeX: React.FC<IconProps>;
  export const Info: React.FC<IconProps>;
}

