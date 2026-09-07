현재 이미지 기반 semantic tag VLM 프롬프트의 성능을 검증하기 위한
evaluation pipeline을 구현하려고 한다.

현재 실제 DB 전체 backfill은 하지 말고,
먼저 SUN Attribute Database를 이용한 독립적인 prompt evaluation 환경을 만들어줘.

==================================================
1. 현재 프로젝트 구조
==================================================

장소당 이미지 3장을 VLM으로 각각 분석하고 있다.

image_1 ─→ VLM ─→ 35 detail scores
image_2 ─→ VLM ─→ 35 detail scores
image_3 ─→ VLM ─→ 35 detail scores
                     ↓
                태그별 평균
                     ↓
           장소 단위 35 detail scores
                     ↓
             5개씩 산술평균
                     ↓
                7 majorScores

7 majorScores:

relaxing
- quiet
- peaceful
- spacious
- nature_friendly
- stay_long

lively
- crowded
- energetic
- colorful
- dynamic
- social

romantic
- warm_mood
- intimate
- date_friendly
- night_mood
- emotional

local
- local_identity
- daily_life
- authentic
- market_alley
- hidden_gem

photogenic
- scenic
- composition
- landmark
- viewpoint
- photo_spot

traditional
- traditional_architecture
- historical
- cultural
- natural_material
- heritage_mood

modern
- modern_architecture
- minimal
- urban
- trendy
- artistic


==================================================
2. 이번 테스트 목적
==================================================

이번 테스트의 목적은:

"현재 VLM prompt가 사람이 판단한 공간의 시각적 attribute와
비슷한 방향으로 점수를 부여하는가?"

를 검증하는 것이다.

SUN Attribute Database를 외부 benchmark로 사용한다.

SUN은:
- 14,340 images
- 102 scene attributes
- 이미지별 human annotation
을 가지고 있다.

중요:

SUN은 우리 35개 detail tag를 위해 만들어진 데이터셋이 아니다.

따라서 SUN으로 35개 전체를 평가하지 않는다.

SUN attribute와 의미가 충분히 대응되는 일부 detail tag만
external validation 대상으로 사용한다.

즉:

SUN evaluation
= 전체 프롬프트 정확도 평가 X
= 대응 가능한 일부 visual attribute에 대한 외부 타당성 검증 O


==================================================
3. 현재 확보한 SUN 파일
==================================================

다음 세 파일을 확보했다.

attributeLabels_continuous.mat
attributes.mat
images.mat

각 역할:

images.mat
→ 14,340개 SUN 이미지 path

attributes.mat
→ 102개 SUN attribute 이름

attributeLabels_continuous.mat
→ 이미지 × attribute human annotation score

세 파일의 동일 index가 대응된다.

예:

images[i]
attributes[j]
attributeLabels_continuous[i][j]

→ image i에 대해 human이 attribute j를 얼마나 강하게 판단했는지


==================================================
4. 우선 검증 후보 attribute
==================================================

현재 다음 mapping을 후보로 생각하고 있다.

우선 의미가 직접적이거나 비교적 가까운 것만 사용한다.

SUN                         OUR DETAIL TAG

open area               →   spacious
soothing                →   peaceful
natural                 →   nature_friendly
vegetation              →   nature_friendly
socializing             →   social
wood (not part of tree) →   natural_material
rock / stone            →   natural_material
warm                    →   warm_mood


단, mapping을 코드에 바로 확정하지 말고 다음 등급을 지원하도록 만들어라.

DIRECT
- 두 attribute 의미가 거의 동일
- 정량 평가에 사용 가능

PROXY
- 관련은 있지만 동일한 의미는 아님
- 참고 결과로만 사용

UNSUPPORTED
- 대응하기 어려움
- 평가하지 않음


예:

open area ↔ spacious
→ DIRECT 후보

soothing ↔ peaceful
→ DIRECT 또는 PROXY 후보

cluttered space ↔ crowded
→ UNSUPPORTED

중요:
crowded를 cluttered와 동일하게 취급하지 않는다.
사람이 붐비는 것과 공간이 복잡한 것은 다른 개념이다.

또한 다음과 같은 우리 서비스 특화 태그를
SUN attribute에 억지로 mapping하지 않는다.

hidden_gem
date_friendly
local_identity
heritage_mood
photo_spot
traditional_architecture
modern_architecture

등.


==================================================
5. 평가 이미지 선정
==================================================

최종적으로 약 30장의 SUN image로 작은 evaluation set을 만든다.

완전 random sampling은 사용하지 않는다.

각 검증 attribute에 대해 human score가 다양한 이미지를
stratified sampling한다.

예:

spacious / open area

high
1.0

medium-high
0.667

medium-low
0.333

negative
0.0

와 같이 positive/ambiguous/negative가 모두 들어가게 한다.

가능하면 특정 scene category에 이미지가 과도하게 몰리지 않도록 한다.

목표는:

"VLM이 positive만 맞추는지"

가 아니라

"attribute 강도가 변할 때 VLM score도 같은 방향으로 변하는지"

를 확인하는 것이다.


==================================================
6. 이미지 다운로드
==================================================

현재 SUN 전체 이미지 파일은 약 1.7GB이고 다운로드 중이다.

다운로드 완료 후 images.mat의 path를 이용해서
evaluation 대상으로 선정된 이미지 30장만 별도 디렉터리에 복사한다.

예:

ai/evaluation/sun/
    images/
        ...
    metadata.json
    mappings.py
    evaluator.py
    results/


전체 14,340장을 evaluation에 사용하지 않는다.

SUN 원본 dataset은 source dataset이고,
실제 prompt evaluation에는 선정된 subset만 사용한다.


==================================================
7. VLM 실행
==================================================

evaluation 이미지 각각에 현재 production과 동일한
VLM prompt를 적용한다.

단 SUN image는 장소당 3장이 아니라
각각 하나의 독립적인 scene image이므로
multi-image aggregation을 적용하지 않는다.

SUN image
    ↓
현재 VLM Prompt
    ↓
35 detail_scores

여기서 evaluation 대상 detail tag만 가져온다.

예:

SUN open area = 1.0

VLM:
spacious = 0.82

이런 pair를 저장한다.


==================================================
8. 평가 방법
==================================================

절대로 임의의 threshold=0.5를 사용해서
맞음/틀림으로 단순 평가하지 않는다.

SUN human annotation과 우리 VLM score는
서로 calibration scale이 완전히 같다고 가정할 수 없다.

예:

Human

A = 1.00
B = 0.667
C = 0.333
D = 0.00

VLM

A = 0.85
B = 0.72
C = 0.48
D = 0.16

이면 숫자가 정확히 같지는 않지만
attribute 강도 순서는 매우 잘 재현한 것이다.

따라서 primary metric:

Spearman rank correlation

을 사용한다.

attribute별로:

attribute
sample_count
spearman_rho

를 출력한다.

예:

spacious          0.81
peaceful          0.74
nature_friendly   0.79
social            0.68


가능하면 보조 지표로:

Pearson correlation
MAE

도 계산한다.

단 MAE는 scale calibration 차이가 있으므로
primary metric으로 사용하지 않는다.


==================================================
9. 여러 SUN attribute → 하나의 우리 tag
==================================================

nature_friendly처럼:

natural
vegetation

두 SUN attribute가 대응될 수 있다.

natural_material 역시:

wood
rock / stone

등 여러 attribute가 대응될 수 있다.

이 경우 임의로 바로 평균하지 말고
mapping config에서 aggregation 방식을 명시하도록 설계한다.

예:

nature_friendly:
    sun_attributes:
        - natural
        - vegetation
    aggregation: mean

natural_material:
    sun_attributes:
        - wood
        - rock/stone
    aggregation: max

단 실제 SUN attribute 정확한 이름을 attributes.mat에서 확인하고 사용한다.


==================================================
10. 결과 저장
==================================================

각 이미지별 raw evaluation 결과를 보존한다.

예:

{
    "image": "...",
    "mapping": "open area -> spacious",
    "human_score": 0.667,
    "vlm_score": 0.72,
    "prompt_version": "...",
    "model": "..."
}

그리고 전체 summary:

{
    "prompt_version": "...",
    "attributes": {
        "spacious": {
            "samples": 10,
            "spearman": 0.81,
            "pearson": 0.78,
            "mae": 0.14
        }
    },
    "macro_average_spearman": ...
}


==================================================
11. Prompt version 비교
==================================================

이 evaluation pipeline의 가장 중요한 목적은
프롬프트 버전 비교다.

동일한 evaluation images를 고정해서 사용한다.

Prompt V1
    ↓
SUN Eval

Prompt V2
    ↓
동일 SUN Eval

Prompt V3
    ↓
동일 SUN Eval

결과 예:

                    V1      V2      V3

spacious           .51     .68     .81
peaceful           .62     .70     .74
nature_friendly    .58     .72     .79
social             .43     .61     .68

macro Spearman     .54     .68     .76

이런 식으로 프롬프트 수정이 실제 human annotation과의
일치도를 개선했는지 확인한다.


==================================================
12. Prompt 수정 원칙
==================================================

SUN 결과에 맞추기 위해 전체 prompt를 무작정 수정하지 않는다.

attribute별 failure case를 확인한다.

예:

open area human score가 낮은데
VLM spacious가 계속 높음

→ 해당 이미지를 확인

→ 원인:
"피사체가 적다는 이유만으로 spacious를 높게 평가"

→ spacious 정의에 명시적인 negative rule 추가

예:

"단순히 피사체가 적거나 정돈되어 있다는 이유만으로
spacious를 높게 평가하지 않는다."

이런 식으로 실제 failure pattern을 근거로 prompt를 수정한다.

특정 SUN 이미지 하나를 맞히기 위한 예외 규칙은 만들지 않는다.


==================================================
13. Development / Test 분리
==================================================

가능하다면 evaluation 이미지를 두 그룹으로 분리할 수 있게 설계한다.

development
→ prompt 수정 과정에서 failure 분석

test
→ 최종 prompt 평가

현재 이미지 수가 작으므로 처음에는:

dev 20
test 10

정도로 시작해도 된다.

단 30장으로 correlation을 계산하면 표본 수가 매우 작으므로
결과를 강한 통계적 결론으로 해석하지 않는다.

필요하면 이후 60~100장으로 확장할 수 있게 구현한다.


==================================================
14. SUN 이후 별도 평가
==================================================

SUN 테스트가 성공했다고 해서
35개 detail tag 전체가 검증된 것은 아니다.

최종적으로는:

[External benchmark]

SUN
→ 대응 가능한 기본 visual attributes 검증


[Domain benchmark]

안동 실제 장소 이미지
→ 서비스 특화 35 detail tag 검증

두 평가를 분리할 예정이다.

특히:

traditional_architecture
heritage_mood
local_identity
hidden_gem
date_friendly
photo_spot

등은 SUN 결과로 정확성을 주장하지 않는다.


==================================================
15. 현재 단계에서 하지 말 것
==================================================

아직 다음 작업은 하지 않는다.

- 전체 DB backfill
- 전체 Qdrant rebuild
- 0.5 threshold 기반 평가
- majorScore 기준 평가
- 추천 알고리즘 변경
- SUN에 맞추기 위한 35개 tag 구조 변경

현재는 detail tag VLM prompt의
독립 evaluation 환경 구축만 한다.


==================================================
16. 최종 목표 흐름
==================================================

현재 Prompt
      ↓
SUN external benchmark
      ↓
failure analysis
      ↓
Prompt 수정
      ↓
SUN benchmark 재평가
      ↓
Prompt 후보 확정
      ↓
안동 domain evaluation
      ↓
최종 Prompt 확정
      ↓
전체 DB 3-image VLM backfill
      ↓
35 detail raw scores
      ↓
7 major raw scores
      ↓
Qdrant vector 생성
      ↓
추천 알고리즘 평가


==================================================
17. 우선 구현 요청
==================================================

우선 다음 작업부터 해줘.

1. 현재 업로드/프로젝트 내 SUN .mat 파일 구조 확인
2. attributes.mat의 실제 102개 attribute 이름 출력
3. 위 mapping 후보가 실제 SUN attribute 이름과 정확히 일치하는지 검증
4. mapping config 작성
5. attribute별 human score 분포 분석
6. 약 30장의 stratified evaluation image path 선정
7. 선정 결과를 JSON/CSV로 저장
8. VLM evaluation runner 구현
9. Spearman/Pearson/MAE evaluator 구현
10. prompt_version별 결과 비교 가능하도록 구성

코드를 작성하기 전에 현재 프로젝트의 VLM client,
prompt.py, model/schema, score calculator 구조를 먼저 확인하고
기존 production 코드를 불필요하게 수정하지 않는 방향으로 설계해줘.

또한 구현하면서 SUN attribute와 우리 detail tag의 의미가
불충분하게 대응되는 mapping이 발견되면 임의로 결정하지 말고
DIRECT / PROXY / UNSUPPORTED 후보와 이유를 먼저 정리해줘.