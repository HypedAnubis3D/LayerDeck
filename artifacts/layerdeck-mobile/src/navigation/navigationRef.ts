import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-expect-error -- generic cross-navigator navigation by screen name
    navigationRef.navigate(name, params);
  }
}
