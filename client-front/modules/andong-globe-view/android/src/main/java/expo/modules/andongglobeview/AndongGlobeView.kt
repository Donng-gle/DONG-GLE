package expo.modules.andongglobeview

import android.content.Context
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

// "나의 일지" 탭 히어로 — 안동시 지도 이미지를 세로축(Y) 중심으로 회전시켜 지구본처럼 보이게 함.
//
// RN의 `transform: rotateY`(JS/CSS 트랜스폼 흉내)로 먼저 시도했는데 실기기에서 회전 중 가장자리가
// 계단식으로 깨지는 문제가 있어서(2026-09-04, decision-log 참고) 안드로이드 View가 기본 제공하는
// rotationY + cameraDistance(하드웨어 가속 레이어) 방식으로 옮김. View.rotationY는 안드로이드가
// 직접 3D 변환 행렬을 계산해서 하드웨어 레이어에 그려주기 때문에 CSS 흉내보다 안티에일리어싱 품질이
// 훨씬 좋음.
class AndongGlobeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val imageView = ImageView(context).apply {
    scaleType = ImageView.ScaleType.CENTER_INSIDE
    setImageResource(R.drawable.andong_globe_map)
    // 안드로이드 3D 뷰 회전은 소프트웨어 레이어에서는 이상하게(깨져) 그려질 수 있어서
    // 하드웨어 레이어를 명시적으로 강제 — CSS rotateY보다 매끈한 안티에일리어싱의 핵심
    setLayerType(View.LAYER_TYPE_HARDWARE, null)
  }

  init {
    val params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply {
      gravity = Gravity.CENTER
    }
    addView(imageView, params)
    // 기본 카메라 거리(뷰 크기와 무관하게 안드로이드가 잡아주는 값)는 원근 왜곡이 거의 없어서
    // "평평한 종이" 느낌이 남 — JS에서 cameraDistance prop으로 명시적으로 좁혀서 곡면 느낌을 냄
    setCameraDistanceDp(12f)
  }

  fun setRotationYDeg(deg: Float) {
    imageView.rotationY = deg
  }

  // Android의 View.cameraDistance는 "8 * density" 단위를 내부적으로 쓰는 raw 픽셀 값이라 감이 안 옴 —
  // dp로 받아서 density를 곱해준 뒤 8을 곱해 넘김(공식 문서 기준 변환). 값이 작을수록 카메라가
  // 가까워져서(=원근 왜곡이 강해져서) 곡면처럼 보이고, 값이 크면 거의 정사영이 되어 평평해 보임.
  fun setCameraDistanceDp(distanceDp: Float) {
    val density = resources.displayMetrics.density
    imageView.cameraDistance = distanceDp * density * 8f
  }
}
