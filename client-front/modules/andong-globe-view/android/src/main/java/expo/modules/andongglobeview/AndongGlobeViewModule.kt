package expo.modules.andongglobeview

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AndongGlobeViewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndongGlobeView")

    View(AndongGlobeView::class) {
      // 드래그로 계산한 회전각(도) — JS PanResponder가 계산해서 그대로 내려줌
      Prop("rotationDeg") { view: AndongGlobeView, value: Float ->
        view.setRotationYDeg(value)
      }
      // 카메라 거리(인치) — 작을수록(기본 8) 원근 왜곡이 강해져서 곡면처럼 보임. 튜닝용으로 JS에서 조절 가능
      Prop("cameraDistanceInches") { view: AndongGlobeView, value: Float ->
        view.setCameraDistanceInches(value)
      }
    }
  }
}
