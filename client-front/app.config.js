const appJson = require('./app.json');

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
  ],
});
