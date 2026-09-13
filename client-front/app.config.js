const { withInfoPlist } = require('@expo/config-plugins');

const appJson = require('./app.json');

// app.json의 ios.infoPlist.NSAppTransportSecurity(visitkorea.or.kr 예외)를 그대로 뒀더니, iOS
// 실기기 재빌드 후에도 관광지/문화공간 사진(http://tong.visitkorea.or.kr)이 계속 안 보였음
// (2026-09-14). 생성된 ios/app/Info.plist를 까보니 NSAppTransportSecurity가 우리 설정이 아니라
// {NSAllowsArbitraryLoads:false, NSAllowsLocalNetworking:true}로 통째로 덮여있었다 — expo-dev-client
// 계열 어딘가(정확한 출처는 node_modules grep으로도 못 찾음, 아마 @expo/config-plugins/CLI 내부
// 로직)가 NSAppTransportSecurity 키 전체를 나중에 다시 쓰는 것으로 보임. app.json의 정적
// infoPlist는 병합이 아니라 먼저 세팅되고 나중에 덮어써지는 것 같으니, 대신 우리 plugins 배열
// 맨 끝에 이 커스텀 plugin을 둬서(plugins는 등록 순서대로 mods가 쌓이고 나중 것이 나중에 실행됨)
// 다른 무엇이 NSAppTransportSecurity를 어떻게 바꿔놨든 그 위에 우리 예외만 병합해서 확실히
// 남긴다.
function withVisitKoreaAtsException(config) {
  return withInfoPlist(config, (config) => {
    const existingAts = config.modResults.NSAppTransportSecurity ?? {};
    config.modResults.NSAppTransportSecurity = {
      // 이 프로젝트의 실제 생성 결과물에서 관찰된 값이라 우리가 직접 보장해둔다 —
      // Metro 로컬 연결(USB/LAN)에 필요할 수 있어 우리 예외 추가로 없어지면 안 됨
      NSAllowsLocalNetworking: true,
      ...existingAts,
      NSExceptionDomains: {
        ...(existingAts.NSExceptionDomains ?? {}),
        'visitkorea.or.kr': {
          NSExceptionAllowsInsecureHTTPLoads: true,
          NSIncludesSubdomains: true,
        },
      },
    };
    return config;
  });
}

// app.json은 정적 설정 그대로 유지하고, 여기서 딱 하나(Google Maps API 키)만 .env에서 읽어와 얹는다.
// 이 키는 android.package + SHA-1로 제한된 클라이언트용 키라 커밋해도 되는 값이지만(2026-08-31 결정,
// decision-log 참고), app.json은 정적 JSON이라 process.env를 못 읽어서 app.config.js가 필요했음
//
// iOS도 같은 키를 재사용(2026-09-14) — Google Cloud Console의 "애플리케이션 제한사항"이 Android
// 앱으로 지정돼 있으면 iOS 요청은 REQUEST_DENIED로 거부됨. iOS 시뮬레이터에서 지도가 안 뜨면
// 코드 문제가 아니라 콘솔에서 이 키의 애플리케이션 제한사항에 iOS 앱(bundle ID:
// com.dongle.andong)을 추가/전환했는지부터 확인할 것.
//
// iOS는 `ios.config.googleMapsApiKey`(Expo 구버전 내장 플러그인, `react-native-google-maps`라는
// 옛날 패키지명의 podspec을 찾아서 `pod install`이 실패함)가 아니라 react-native-maps 1.27.2가
// 자체 제공하는 config plugin을 써야 함 — 이게 Podfile에 `react-native-maps/Google` 서브스펙을
// 추가하고 Info.plist GMSApiKey + AppDelegate GMSServices.provideAPIKey까지 다 처리해줌
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  // Pretendard 폰트(assets/fonts) 로드용 — expo-font 자동 config-plugin이 app.json에 못 써서 수기로 추가
  plugins: [
    ...(appJson.expo.plugins ?? []),
    'expo-font',
    ['react-native-maps', { iosGoogleMapsApiKey: googleMapsApiKey }],
    // 반드시 마지막 — 위 플러그인들(특히 react-native-maps)이 NSAppTransportSecurity를
    // 건드린 뒤에 우리 예외를 병합해야 안 덮어써짐
    withVisitKoreaAtsException,
  ],
});
