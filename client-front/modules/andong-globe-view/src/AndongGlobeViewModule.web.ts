import { registerWebModule, NativeModule } from 'expo';

// AndongGlobeViewModule is not available on the web platform.
class AndongGlobeViewModule extends NativeModule<{}> {}

export default registerWebModule(AndongGlobeViewModule, 'AndongGlobeViewModule');
