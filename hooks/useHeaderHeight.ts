import { useState, useCallback } from 'react';
import { LayoutChangeEvent } from 'react-native';

export function useHeaderHeight() {
  const [headerHeight, setHeaderHeight] = useState(0);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setHeaderHeight(height);
  }, []);

  return {
    headerHeight,
    onHeaderLayout,
  };
}
