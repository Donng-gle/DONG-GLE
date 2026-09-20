// Metro는 플랫폼별 파일(AndongGlobeView.ios.tsx / .android.tsx / .web.tsx)을 우선 찾고, 그게
// 없는 플랫폼에서만 이 확장자 없는 파일로 폴백한다. ios/android/web을 전부 명시적으로 갖춰둔
// 상태라 런타임에선 이 파일이 실제로 쓰일 일이 없고, `tsc`가 `./src/AndongGlobeView`를(플랫폼
// 확장자 없이) 그대로 찾을 때를 위한 타입 체크용 폴백으로만 존재한다(moduleSuffixes 미설정 상태).
export { default } from './AndongGlobeView.ios';
