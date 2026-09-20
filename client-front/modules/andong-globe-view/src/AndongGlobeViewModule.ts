import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AndongGlobeViewModule extends NativeModule<{}> {}

// Android에만 실제 네이티브 모듈이 있음(iOS는 AndongGlobeView.ios.tsx가 순수 RN transform으로
// 대체 — 같은 디렉토리 주석 참고). requireNativeModule은 없으면 던지는데, 이 default export
// 자체는 실제로 쓰이는 곳이 없어서(View 컴포넌트만 씀) iOS에서 "Cannot find native module"로
// 런타임이 죽을 이유가 없음 — requireOptionalNativeModule로 없으면 null 반환하도록 완화
// (2026-09-13 iOS 시뮬레이터 빌드로 확인)
export default requireOptionalNativeModule<AndongGlobeViewModule>('AndongGlobeView');
