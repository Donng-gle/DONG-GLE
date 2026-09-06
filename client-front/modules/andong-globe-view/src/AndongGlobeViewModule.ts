import { NativeModule, requireNativeModule } from 'expo';

declare class AndongGlobeViewModule extends NativeModule<{}> {}

export default requireNativeModule<AndongGlobeViewModule>('AndongGlobeView');
