const appJson = require('./app.json');

// app.json은 정적 설정 그대로 유지하고, 여기서 딱 하나(Google Maps API 키)만 .env에서 읽어와 얹는다.
// 이 키는 android.package + SHA-1로 제한된 클라이언트용 키라 커밋해도 되는 값이지만(2026-08-31 결정,
// decision-log 참고), app.json은 정적 JSON이라 process.env를 못 읽어서 app.config.js가 필요했음
module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
  // Pretendard 폰트(assets/fonts) 로드용 — expo-font 자동 config-plugin이 app.json에 못 써서 수기로 추가
  plugins: [...(appJson.expo.plugins ?? []), 'expo-font'],
});
