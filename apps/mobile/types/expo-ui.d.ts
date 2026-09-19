declare module '@expo/ui' {
  const content: unknown;
  export = content;
}

declare module '@expo/ui/swift-ui' {
  export const ControlGroup: React.ComponentType<Record<string, unknown>>;
  export const Host: React.ComponentType<Record<string, unknown>>;
  export const Picker: React.ComponentType<Record<string, unknown>>;
  export const Switch: React.ComponentType<Record<string, unknown>>;
  export const Slider: React.ComponentType<Record<string, unknown>>;
}

declare module '@expo/ui/jetpack-compose' {
  export const DropdownMenu: React.ComponentType<Record<string, unknown>>;
  export const DropdownMenuItem: React.ComponentType<Record<string, unknown>>;
  export const HorizontalDivider: React.ComponentType<Record<string, unknown>>;
  export const RNHostView: React.ComponentType<Record<string, unknown>>;
}

declare module '@expo/ui/jetpack-compose/modifiers' {
  export function padding(value: number): unknown;
  export function spacedBy(value: number): unknown;
}
