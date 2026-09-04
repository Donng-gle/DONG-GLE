package expo.modules.andongglobeview

import android.content.Context
import android.graphics.Canvas
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
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
    // RN의 resizeMode="contain"과 동일한 동작 — CENTER_INSIDE는 축소만 하고 확대는 안 해서
    // 원본이 작은 이미지(360x360)가 큰 컨테이너 안에서 작게 남는 문제가 있었음
    scaleType = ImageView.ScaleType.FIT_CENTER
    setImageResource(R.drawable.andong_globe_map)
    // 안드로이드 3D 뷰 회전은 소프트웨어 레이어에서는 이상하게(깨져) 그려질 수 있어서
    // 하드웨어 레이어를 명시적으로 강제 — CSS rotateY보다 매끈한 안티에일리어싱의 핵심
    setLayerType(View.LAYER_TYPE_HARDWARE, null)
  }

  init {
    // 자식(imageView)이 rotationY + cameraDistance로 3D 회전할 때 이 부모(AndongGlobeView) 경계
    // 밖으로 그려지는 문제가 있었음 — clipChildren=true, outline 기반 클리핑(clipToOutline +
    // ViewOutlineProvider.BOUNDS) 둘 다 시도했지만 하드웨어 레이어로 GPU 합성되는 3D 회전 자식은
    // 안 잘림(실기기로 확인, 2026-09-04). dispatchDraw에서 canvas.clipRect를 직접 걸어서 강제로
    // 박스 안에 가두는 방식으로 최종 해결 — 아래 dispatchDraw 오버라이드 참고
    clipChildren = true
    outlineProvider = ViewOutlineProvider.BOUNDS
    clipToOutline = true

    val params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply {
      gravity = Gravity.CENTER
    }
    addView(imageView, params)
    // 기본 카메라 거리(호출 안 하면 안드로이드가 8인치로 잡음)는 원근 왜곡이 거의 없어서
    // "평평한 종이" 느낌이 남 — JS에서 cameraDistanceInches prop으로 명시적으로 좁혀서 곡면 느낌을 냄
    setCameraDistanceInches(8f)
  }

  // clipChildren/clipToOutline로는 rotationY + 하드웨어 레이어 조합의 자식을 못 잘라서(실기기 확인),
  // 캔버스에 직접 클립 사각형을 걸어서 확실하게 이 뷰의 경계 밖으로 못 나가게 강제
  override fun dispatchDraw(canvas: Canvas) {
    canvas.save()
    canvas.clipRect(0, 0, width, height)
    super.dispatchDraw(canvas)
    canvas.restore()
  }

  fun setRotationYDeg(deg: Float) {
    imageView.rotationY = deg
  }

  // Android View.cameraDistance는 "raw 픽셀" 값을 받아서 내부적으로 densityDpi로 나눠 "인치" 단위
  // 카메라 Z 위치로 씀 (View.java: camera.setLocation(0, 0, -distance/dpi), 기본값 8인치).
  // 처음에 dp*density*8로 잘못 계산해서(8을 중복으로 곱함) 카메라가 너무 가까워져 회전만 해도
  // 화면을 뒤덮을 만큼 극단적으로 왜곡되는 버그가 있었음 — inches 단위를 직접 받아서 dpi만 곱하도록
  // 수정 (2026-09-04). 값이 작을수록(카메라가 가까워질수록) 원근 왜곡이 강해져서 곡면처럼 보이고,
  // 크면(기본 8인치) 거의 정사영이 되어 평평해 보임 — 실기기로 튜닝 필요
  fun setCameraDistanceInches(distanceInches: Float) {
    val dpi = resources.displayMetrics.densityDpi
    imageView.cameraDistance = distanceInches * dpi
  }
}
