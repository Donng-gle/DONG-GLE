import { requireNativeView } from 'expo';
import * as React from 'react';

import { AndongGlobeViewProps } from './AndongGlobeView.types';

const NativeView: React.ComponentType<AndongGlobeViewProps> = requireNativeView('AndongGlobeView');

export default function AndongGlobeView(props: AndongGlobeViewProps) {
  return <NativeView {...props} />;
}
