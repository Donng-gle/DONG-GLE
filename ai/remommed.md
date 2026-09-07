# Hidden Spot Score 실험 및 분석 기능 구현 요청

기존 관광지 추천 프로젝트의 장소 데이터를 활용하여, **숨은 명소를 판별하기 위한 Hidden Spot Score 실험 및 분석 기능**을 `ai` 폴더에 구현해 주세요.

현재 실험 대상 지역은 **안동시**입니다.

---

# 1. 프로젝트 목적

사용자의 사진 취향과 관련성이 높은 안동 관광지 중에서 다음 조건을 만족하는 장소를 우선 추천하려고 합니다.

* Google Maps 리뷰 수가 너무 적지 않아 어느 정도 방문자에게 검증된 장소
* Google Maps 리뷰 수가 지나치게 많지 않아 아직 대중적으로 과도하게 알려지지 않은 장소
* Google Maps 평점이 높은 장소
* 한국관광공사의 기초지자체 중심 관광지 순위에서 지속적으로 높은 순위에 등장하지 않는 장소
* 최근 1년 동안 대표적인 차량 연계 관광 동선의 중심에 자주 포함되지 않은 장소

즉, 단순히 리뷰가 적거나 관광공사 순위에 없는 장소가 아니라 다음 조건을 함께 만족하는 장소를 높은 점수로 평가해야 합니다.

> Google Maps 리뷰가 적당히 존재하고, 평점이 높으며, 최근 1년 동안 안동시 중심 관광지 상위 100위에 자주 등장하지 않거나 평균 순위가 낮은 장소

Google Maps 평점 점수와 관광공사 중심 관광지 점수는 일정한 기준으로 계산할 수 있지만, **Google Maps 리뷰 수를 어느 범위에서 가장 높게 평가할지는 여러 점수 구간을 실험하여 결정**하려고 합니다.

---

# 2. 데이터 활용 범위

## 2.1 Google Maps 장소 데이터

현재 프로젝트에서 관리하는 안동 관광지 데이터를 사용합니다.

각 장소에는 최소한 다음 정보가 존재한다고 가정합니다.

* 장소 ID
* 장소명
* 지역
* 카테고리
* Google Maps 리뷰 수
* Google Maps 평점
* 사진 관련성 점수

Google 리뷰 수의 상대적 위치는 카테고리별로 분리하지 않고, **프로젝트에 저장된 안동시 전체 후보 관광지의 리뷰 수 분포**를 기준으로 계산합니다.

즉, 다음 기준은 사용하지 않습니다.

```text
같거나 유사한 장소 카테고리별 백분위
```

대신 다음 기준을 사용합니다.

```text
안동시 전체 후보 관광지 내 Google 리뷰 수 백분위
```

---

## 2.2 한국관광공사 중심 관광지 데이터

한국관광공사의 다음 데이터를 활용합니다.

```text
한국관광공사_기초지자체 중심 관광지 정보
```

이 데이터는 TMAP 사용자의 차량 이동 데이터를 기반으로, 특정 기초지자체에서 다른 관광지와 연계 방문되는 빈도가 높은 관광지 1위부터 100위까지를 제공합니다.

이 순위는 단순 방문자 수나 절대적인 인기도가 아니라 다음 의미로 해석합니다.

> 해당 지역의 차량 기반 관광 동선에서 다른 관광지와 자주 연결되는 중심 관광지 또는 관광 허브 정도

안동시 데이터를 월별로 조회하고, **최근 12개월의 1위부터 100위까지 데이터를 모두 수집**합니다.

예:

```text
2025년 8월 안동시 중심 관광지 1~100위
2025년 9월 안동시 중심 관광지 1~100위
...
2026년 7월 안동시 중심 관광지 1~100위
```

각 장소에 대해 최근 12개월의 다음 통계값을 계산합니다.

```text
최근 12개월 등장 횟수
등장률
등장한 월의 평균 순위
가장 높은 순위
가장 낮은 순위
최근 등장 월
월별 순위 목록
```

예:

```text
하회마을
- 최근 12개월 등장 횟수: 12회
- 등장률: 1.0
- 평균 순위: 2.3위

장소 A
- 최근 12개월 등장 횟수: 3회
- 등장률: 0.25
- 평균 순위: 78.7위

장소 B
- 최근 12개월 등장 횟수: 0회
- 등장률: 0
- 평균 순위: null
```

---

# 3. 핵심 점수 구조

최종 Hidden Spot Score는 다음 세 요소로 구성합니다.

```text
HiddenSpotScore
=
ReviewSweetSpotScore
+ RatingScore
+ TourismCentralityAbsenceScore
```

모든 하위 점수는 `0~100` 범위로 정규화하고, 최종 계산 시 가중치를 적용합니다.

```text
HiddenSpotScore
=
reviewWeight × ReviewSweetSpotScore
+ ratingWeight × RatingScore
+ tourismWeight × TourismCentralityAbsenceScore
```

기본 가중치는 다음 값으로 시작합니다.

```text
reviewWeight = 0.40
ratingWeight = 0.35
tourismWeight = 0.25
```

가중치는 설정 객체에서 쉽게 수정할 수 있어야 합니다.

최종 Hidden Spot Score는 높을수록 다음 조건에 가까운 장소를 의미합니다.

```text
적당한 Google 리뷰 수
+
높고 신뢰할 수 있는 Google 평점
+
최근 1년 동안 낮은 관광 동선 중심성
```

---

# 4. Google 리뷰 수 점수

## 4.1 핵심 요구사항

Google 리뷰 수가 적을수록 무조건 높은 점수를 부여하면 안 됩니다.

리뷰 수는 다음 세 가지 상태로 구분합니다.

```text
리뷰가 너무 적음
→ 평점과 장소 품질의 신뢰성이 부족하므로 낮은 점수

리뷰가 적당히 있음
→ 방문자에게 어느 정도 검증됐지만 과도하게 유명하지 않으므로 높은 점수

리뷰가 너무 많음
→ 이미 대중적으로 유명한 장소일 가능성이 있으므로 낮은 점수
```

따라서 ReviewSweetSpotScore는 단조 증가 또는 단조 감소 함수가 아니라, **중간 리뷰 구간에서 최고점을 가지는 산 모양 함수**로 구현해야 합니다.

---

## 4.2 안동시 전체 후보 기준 백분위 계산

Google 리뷰 수 백분위는 장소 카테고리를 구분하지 않고, **안동시 전체 후보 관광지**를 기준으로 계산합니다.

각 장소의 리뷰 수 백분위를 `reviewPercentile`이라는 `0~1` 범위의 값으로 계산합니다.

```text
reviewPercentile = 0
→ 안동시 후보 중 리뷰 수가 가장 적은 수준

reviewPercentile = 1
→ 안동시 후보 중 리뷰 수가 가장 많은 수준
```

동일한 리뷰 수를 가진 장소가 여러 개 존재할 경우에는 동일하거나 평균화된 백분위를 부여하는 등 일관된 기준을 사용해 주세요.

장소 카테고리는 데이터에 유지할 수 있지만, 리뷰 수 백분위 계산 그룹을 나누는 기준으로 사용하지 않습니다.

---

## 4.3 기본 리뷰 점수 기준

첫 번째 baseline은 다음과 같이 설정합니다.

| 리뷰 수 백분위 | ReviewSweetSpotScore |
| -------: | -------------------: |
|     0.00 |                    0 |
|     0.10 |                   30 |
|     0.25 |                   80 |
|     0.40 |                  100 |
|     0.60 |                   90 |
|     0.75 |                   60 |
|     0.90 |                   20 |
|     1.00 |                    0 |

중간 지점 사이의 점수는 선형 보간으로 계산해 주세요.

예를 들어 백분위가 `0.25~0.40` 사이에 있다면 점수가 `80~100` 사이에서 선형적으로 증가해야 합니다.

```text
리뷰 수 백분위가 너무 낮음
→ 검증 부족으로 감점

리뷰 수 백분위가 중하위권
→ 높은 점수

리뷰 수 백분위가 상위권
→ 이미 알려진 장소일 가능성이 있어 감점
```

---

## 4.4 최소 리뷰 수 조건

백분위와 별개로 절대 리뷰 수가 지나치게 적은 장소는 신뢰하기 어렵습니다.

기본 기준은 다음과 같습니다.

```text
리뷰 0~4개
→ 추천 후보에서 제외하거나 강한 감점

리뷰 5~9개
→ 낮은 신뢰도 적용

리뷰 10개 이상
→ 정상 평가
```

기준값은 설정 객체나 상수로 분리해 주세요.

```ts
const MIN_REVIEW_COUNT = 5;
const RELIABLE_REVIEW_COUNT = 10;
```

리뷰 수가 `MIN_REVIEW_COUNT`보다 적은 장소를 완전히 제외할지, 점수만 강하게 감점할지도 설정값으로 선택할 수 있도록 구현해 주세요.

---

# 5. Google 평점 점수

Google 평점은 리뷰 수가 적을 때 신뢰도가 떨어지므로, 원래 평점을 그대로 사용하지 말고 전체 평균 평점 방향으로 보정합니다.

다음 공식을 사용합니다.

```text
Reliability
=
reviewCount / (reviewCount + m)
```

```text
AdjustedRating
=
Reliability × googleRating
+
(1 - Reliability) × globalAverageRating
```

각 변수의 의미는 다음과 같습니다.

```text
googleRating
= 해당 장소의 Google Maps 평점

reviewCount
= 해당 장소의 Google Maps 리뷰 수

globalAverageRating
= 안동시 전체 후보 관광지의 평균 Google Maps 평점

m
= 평점 신뢰도 기준 리뷰 수
```

기본값은 다음과 같이 설정합니다.

```text
m = 20
```

리뷰 수가 적은 장소는 원래 평점보다 안동시 전체 평균 평점에 가깝게 보정하고, 리뷰 수가 충분한 장소는 원래 평점에 가까운 값을 유지해야 합니다.

`AdjustedRating`은 다시 `0~100` 범위의 `RatingScore`로 변환합니다.

```text
RatingScore
=
((AdjustedRating - 1) / 4) × 100
```

평점 범위가 `1~5`를 벗어나는 경우 유효하지 않은 데이터로 처리해 주세요.

평점이 일정 기준보다 낮은 장소는 강하게 감점하거나 추천 후보에서 제외할 수 있도록 다음 값을 설정으로 분리해 주세요.

```ts
const MIN_GOOGLE_RATING = 3.5;
```

---

# 6. 관광공사 최근 1년 중심성 점수

## 6.1 점수 의미

기존의 단일 월 관광지 순위 또는 단순 Top100 등장 여부만 사용하지 않습니다.

최근 12개월 동안 각 장소가 안동시 중심 관광지 Top100에:

* 얼마나 자주 등장했는지
* 등장했을 때 평균 순위가 얼마나 높았는지

를 함께 사용해 관광 동선 중심성을 계산합니다.

관광공사 점수는 다음 의미를 가져야 합니다.

```text
최근 12개월 동안 자주 등장하고 순위가 높음
→ 대표적인 관광 동선의 중심 장소
→ 숨은 장소 점수 감소

일부 월에만 등장하고 평균 순위가 낮음
→ 관광 동선 중심성이 낮음
→ 숨은 장소 점수 증가

최근 12개월 동안 한 번도 등장하지 않음
→ 중심 관광지 Top100에 포함되지 않은 장소
→ 가장 높은 숨은 장소 점수
```

---

## 6.2 월별 원본 데이터 구조

월별 관광공사 데이터는 다음과 같은 형태로 관리할 수 있도록 해 주세요.

```ts
interface MonthlyTourismRank {
  yearMonth: string;
  rank: number;
}
```

예:

```ts
{
  yearMonth: "2026-07",
  rank: 38
}
```

각 장소의 최근 12개월 데이터는 다음과 같이 구성합니다.

```ts
interface TourismHistory {
  placeId: string;
  monthlyRanks: MonthlyTourismRank[];
}
```

Top100에 등장하지 않은 월은 `monthlyRanks`에 기록하지 않거나, `rank: null` 형태로 저장할 수 있습니다.

구현 시 한 가지 방식을 일관되게 선택해 주세요.

---

## 6.3 최근 12개월 관광 중심성 통계

각 장소에 대해 다음 값을 계산합니다.

```ts
interface TourismCentralityStats {
  appearanceCount: number;
  appearanceRate: number;
  averageRank: number | null;
  bestRank: number | null;
  worstRank: number | null;
  latestAppearanceMonth: string | null;
}
```

계산 기준은 다음과 같습니다.

```text
appearanceCount
= 최근 12개월 Top100 등장 횟수

appearanceRate
= appearanceCount / 12

averageRank
= 등장한 월들의 순위 평균

bestRank
= 최근 12개월 중 가장 높은 순위

worstRank
= 최근 12개월 중 가장 낮은 순위

latestAppearanceMonth
= 가장 최근에 Top100에 등장한 월
```

예를 들어 12개월 중 3개월에만 등장했다면, 평균 순위 계산 시 등장하지 않은 9개월을 임의로 101위로 넣지 말고 등장한 3개월의 순위만 평균 내 주세요.

대신 미등장 월의 영향은 `appearanceRate`를 통해 별도로 반영합니다.

---

## 6.4 등장 빈도 기반 부재 점수

최근 12개월 동안 적게 등장할수록 높은 점수를 부여합니다.

```text
FrequencyAbsenceScore
=
(1 - appearanceRate) × 100
```

예:

| 등장 횟수 |  등장률 | FrequencyAbsenceScore |
| ----: | ---: | --------------------: |
|   12회 | 1.00 |                     0 |
|    9회 | 0.75 |                    25 |
|    6회 | 0.50 |                    50 |
|    3회 | 0.25 |                    75 |
|    0회 | 0.00 |                   100 |

---

## 6.5 평균 순위 기반 부재 점수

등장한 월의 평균 순위가 낮을수록, 즉 숫자가 클수록 높은 숨은 장소 점수를 부여합니다.

```text
1위
→ RankAbsenceScore = 0

50위
→ RankAbsenceScore ≈ 50

100위
→ RankAbsenceScore ≈ 100
```

기본 공식은 다음과 같이 사용할 수 있습니다.

```text
RankAbsenceScore
=
((averageRank - 1) / 99) × 100
```

최근 12개월 동안 한 번도 등장하지 않아 `averageRank`가 `null`인 경우에는 다음 값을 사용합니다.

```text
RankAbsenceScore = 100
```

결과는 반드시 `0~100` 범위로 제한해 주세요.

---

## 6.6 최종 관광 중심성 부재 점수

최종 관광공사 점수는 등장 빈도와 평균 순위를 결합합니다.

```text
TourismCentralityAbsenceScore
=
frequencyWeight × FrequencyAbsenceScore
+
rankWeight × RankAbsenceScore
```

기본 가중치는 다음과 같이 설정합니다.

```text
frequencyWeight = 0.6
rankWeight = 0.4
```

관광공사 점수에서는 최근 12개월 동안 지속적으로 등장했는지를 평균 순위보다 조금 더 중요하게 평가합니다.

예:

```text
장소 A
- 등장 횟수: 12회
- 평균 순위: 5위
→ 매우 낮은 TourismCentralityAbsenceScore

장소 B
- 등장 횟수: 3회
- 평균 순위: 80위
→ 높은 TourismCentralityAbsenceScore

장소 C
- 등장 횟수: 0회
- 평균 순위: null
→ TourismCentralityAbsenceScore = 100
```

가중치는 설정 객체에서 수정할 수 있어야 합니다.

---

## 6.7 관광공사 점수 실험 모드

관광공사 점수도 한 가지 방식으로 고정하지 말고 다음 방식을 비교할 수 있게 구현해 주세요.

### Mode A: 최근 12개월 등장 여부 중심

```text
등장 횟수와 등장률을 중심으로 평가
```

### Mode B: 최근 12개월 평균 순위 중심

```text
평균 순위를 중심으로 평가
```

### Mode C: 등장 빈도와 평균 순위 결합

```text
FrequencyAbsenceScore 60%
+
RankAbsenceScore 40%
```

기본 모드는 `Mode C`로 설정합니다.

---

# 7. 전체 점수 계산

기본 공식은 다음과 같습니다.

```text
HiddenSpotScore
=
0.40 × ReviewSweetSpotScore
+
0.35 × RatingScore
+
0.25 × TourismCentralityAbsenceScore
```

가중치의 합이 1이 아닐 경우 다음 방식 중 하나를 설정으로 선택할 수 있게 해 주세요.

```text
자동 정규화
또는
유효성 검사 오류 발생
```

각 장소에 대해 다음 계산 결과를 반환해야 합니다.

```ts
interface HiddenSpotScoreResult {
  placeId: string;
  placeName: string;

  reviewCount: number;
  reviewPercentile: number;
  reviewSweetSpotScore: number;

  originalRating: number;
  adjustedRating: number;
  ratingScore: number;

  tourismAppearanceCount: number;
  tourismAppearanceRate: number;
  tourismAverageRank: number | null;
  tourismBestRank: number | null;
  tourismWorstRank: number | null;
  frequencyAbsenceScore: number;
  rankAbsenceScore: number;
  tourismCentralityAbsenceScore: number;

  hiddenSpotScore: number;

  excluded: boolean;
  exclusionReasons: string[];
}
```

---

# 8. 리뷰 점수 구간 실험

최종 목적은 Google 리뷰 수의 적정 기준을 실험적으로 결정하는 것입니다.

한 가지 리뷰 점수 함수만 구현하지 말고, 여러 리뷰 점수 기준을 비교할 수 있는 실험 기능을 만들어 주세요.

모든 실험은 **안동시 전체 후보 관광지의 리뷰 수 백분위**를 기준으로 합니다.

## Experiment A: 리뷰가 비교적 적은 장소 선호

```text
최고점 구간: 20~35백분위
```

## Experiment B: 리뷰가 중하위권인 장소 선호

```text
최고점 구간: 35~50백분위
```

## Experiment C: 리뷰가 중간 수준인 장소 선호

```text
최고점 구간: 45~60백분위
```

각 실험안은 다음 설정 객체로 관리할 수 있도록 해 주세요.

```ts
interface ReviewScoreExperimentConfig {
  id: string;
  name: string;
  percentileScorePoints: Array<{
    percentile: number;
    score: number;
  }>;
  minReviewCount: number;
  reliableReviewCount: number;
}
```

각 실험 결과마다 Hidden Spot Score 기준 상위 10개와 상위 20개 장소를 출력해 주세요.

각 실험에서 동일한 관광공사 최근 12개월 데이터와 Google 평점 보정 공식을 사용하고, 리뷰 점수 곡선만 변경하여 결과를 비교할 수 있어야 합니다.

---

# 9. 사진 관련성 점수와 결합

사용자가 선택한 사진 또는 선호한 사진과 관련성이 있는 장소만 먼저 후보로 선정합니다.

각 장소에는 다음 값이 있다고 가정합니다.

```text
photoRelevanceScore: 0~1
```

먼저 사진 관련성 임계값을 통과한 장소만 남깁니다.

기본값:

```text
photoRelevanceScore >= 0.65
```

그 이후 Hidden Spot Score를 결합해 최종 추천 순위를 계산합니다.

```text
FinalRecommendationScore
=
0.6 × PhotoRelevanceScore
+
0.4 × NormalizedHiddenSpotScore
```

여기서:

```text
NormalizedHiddenSpotScore
=
HiddenSpotScore / 100
```

최종 결과는 `FinalRecommendationScore` 내림차순으로 정렬합니다.

사진 관련성이 임계값보다 낮은 장소가 Hidden Spot Score만 높다는 이유로 추천되지 않도록, 반드시 다음 순서를 지켜 주세요.

```text
사진 관련성 필터링
→ Hidden Spot Score 계산 또는 적용
→ 최종 추천 점수 계산
→ 내림차순 정렬
```

---

# 10. 데이터 구조 예시

다음과 비슷한 형태의 데이터를 입력으로 사용할 예정입니다.

```ts
interface Place {
  id: string;
  name: string;
  region: string;
  category: string;

  googleReviewCount: number;
  googleRating: number;

  tourismHistory: Array<{
    yearMonth: string;
    rank: number;
  }>;

  photoRelevanceScore?: number;
}
```

관광공사 API의 장소명과 Google Maps 장소명이 다를 수 있으므로, 데이터 수집 단계에서 장소를 매칭할 수 있는 별도의 식별자나 매칭 결과를 관리해 주세요.

예:

```ts
interface PlaceMatch {
  placeId: string;
  tourismPlaceName: string | null;
  matched: boolean;
  matchMethod: "exact-name" | "normalized-name" | "coordinate" | "manual" | "none";
  matchConfidence: number;
}
```

장소명이 매칭되지 않았다는 이유만으로 자동으로 관광공사 12개월 미등장 장소로 처리하면 안 됩니다.

다음 두 상태를 구분해야 합니다.

```text
정상적으로 매칭된 장소가 최근 12개월 동안 Top100에 등장하지 않음
→ 관광공사 미등장으로 판단 가능

관광공사 장소와의 매칭 자체가 실패함
→ 데이터 불확실 상태로 처리
```

---

# 11. 구현 요구사항

다음 기능을 각각 독립적인 함수 또는 모듈로 분리해 주세요.

```ts
calculateReviewPercentiles()
calculateReviewSweetSpotScore()

calculateAdjustedRating()
calculateRatingScore()

aggregateTourismHistory()
calculateFrequencyAbsenceScore()
calculateRankAbsenceScore()
calculateTourismCentralityAbsenceScore()

calculateHiddenSpotScore()
calculateFinalRecommendationScore()

runReviewScoreExperiments()
runTourismScoreExperiments()
runHiddenScoreExperiments()
```

추가로 최근 12개월 데이터를 처리하는 기능을 구현해 주세요.

```ts
filterRecentTwelveMonths()
validateMonthlyTourismRanks()
groupTourismRanksByPlace()
```

함수는 가능하면 순수 함수로 작성하고, 점수 기준과 가중치는 설정 객체로 분리해 주세요.

점수 계산에 사용하는 숫자를 함수 내부에 직접 하드코딩하지 말아 주세요.

파이썬 기반의 Fastapi 사용.

유효하지 않은 데이터도 처리해야 합니다.

예:

```text
Google 리뷰 수가 음수
Google 평점이 1~5 범위를 벗어남
관광공사 순위가 1~100 범위를 벗어남
동일 장소에 같은 연월 데이터가 중복됨
최근 12개월보다 오래된 데이터가 섞여 있음
연월 형식이 YYYY-MM이 아님
Google 장소와 관광공사 장소의 매칭 상태가 불확실함
안동시 후보 장소 데이터가 너무 적어 백분위가 불안정함
```

안동시 후보 장소 데이터가 너무 적은 경우에는 전체 데이터로 자동 확장하지 말고, 실험 결과에 표본 수 부족 경고를 포함해 주세요.

현재 실험 범위는 안동시이므로 다른 지역 데이터와 섞어서 리뷰 수 백분위를 계산하면 안 됩니다.

---

# 12. 테스트 요구사항

다음 예시가 의도대로 평가되는지 테스트 코드를 작성해 주세요.

## 장소 A

```text
Google 평점: 5.0
Google 리뷰 수: 2개
관광공사 최근 12개월 등장: 0회
```

예상:

```text
관광공사 점수는 높지만 리뷰 신뢰도가 부족하므로 최상위가 되면 안 됨
```

## 장소 B

```text
Google 평점: 4.7
Google 리뷰 수: 안동시 전체 기준 중하위권
관광공사 최근 12개월 등장: 0회 또는 1회
```

예상:

```text
높은 Hidden Spot Score
```

## 장소 C

```text
Google 평점: 4.7
Google 리뷰 수: 1,500개
관광공사 최근 12개월 등장: 0회
```

예상:

```text
관광공사 점수는 높지만 이미 유명할 가능성이 있어 리뷰 점수 감점
```

## 장소 D

```text
Google 평점: 4.6
Google 리뷰 수: 안동시 전체 기준 중하위권
관광공사 최근 12개월 등장: 12회
평균 순위: 5위
```

예상:

```text
대표적인 관광 동선 중심지이므로 관광공사 점수 강한 감점
```

## 장소 E

```text
Google 평점: 4.6
Google 리뷰 수: 안동시 전체 기준 중하위권
관광공사 최근 12개월 등장: 2회
평균 순위: 85위
```

예상:

```text
관광 동선 중심성이 낮으므로 비교적 높은 관광공사 점수
```

## 장소 F

```text
Google 평점: 3.1
Google 리뷰 수: 안동시 전체 기준 중하위권
관광공사 최근 12개월 등장: 0회
```

예상:

```text
숨겨져 있더라도 추천 품질이 낮으므로 감점 또는 제외
```

특히 다음 조건을 검증해 주세요.

```text
장소 B가 장소 A와 장소 C보다 높은 점수를 받음

장소 E가 장소 D보다 높은 TourismCentralityAbsenceScore를 받음

최근 12개월 미등장 장소가 항상 최상위가 되는 것이 아니라
리뷰 수와 평점 조건을 함께 만족해야 높은 최종 점수를 받음
```

---

# 13. 실험 결과 출력

각 실험안별로 다음 정보를 표 형태로 확인할 수 있게 해 주세요.

```text
최종 순위
장소명

Google 리뷰 수
안동시 리뷰 수 백분위
ReviewSweetSpotScore

Google 원본 평점
Google 보정 평점
RatingScore

최근 12개월 관광공사 등장 횟수
최근 12개월 등장률
평균 순위
최고 순위
최저 순위
FrequencyAbsenceScore
RankAbsenceScore
TourismCentralityAbsenceScore

HiddenSpotScore

사진 관련성 점수
FinalRecommendationScore

제외 여부
제외 사유
데이터 경고
```

가능하면 다음 형식으로 결과를 저장할 수 있도록 해 주세요.

```text
JSON
CSV
```

추가로 각 실험안의 상위 10개와 상위 20개 결과를 비교할 수 있는 요약 파일도 생성해 주세요.

---

# 14. 중요한 설계 원칙

다음 원칙을 반드시 지켜 주세요.

1. Google 리뷰 수가 적을수록 무조건 높은 점수를 주지 않습니다.
2. Google 리뷰가 너무 적으면 평점과 장소 품질의 신뢰도가 부족하므로 감점합니다.
3. Google 리뷰가 적당히 존재하는 안동시 중하위권 장소에 높은 리뷰 점수를 부여합니다.
4. Google 리뷰 수 백분위는 장소 카테고리별로 나누지 않고 안동시 전체 후보 관광지를 기준으로 계산합니다.
5. Google 리뷰 수가 지나치게 많으면 이미 유명한 장소일 가능성이 있으므로 감점합니다.
6. Google 평점은 리뷰 수를 이용해 안동시 전체 평균 평점 방향으로 보정합니다.
7. 관광공사 데이터는 단일 월이 아니라 최근 12개월의 1~100위 데이터를 종합합니다.
8. 관광공사 순위는 절대적인 인기도가 아니라 차량 기반 관광 동선 중심성으로 해석합니다.
9. 최근 12개월 동안 자주 등장하고 평균 순위가 높은 장소는 숨은 장소 점수를 낮춥니다.
10. 최근 12개월 동안 적게 등장하거나 평균 순위가 낮은 장소는 숨은 장소 점수를 높입니다.
11. 최근 12개월 동안 한 번도 등장하지 않은 장소라도 리뷰와 평점이 부족하면 최상위로 추천하지 않습니다.
12. 관광공사 장소와 Google Maps 장소의 매칭 실패를 실제 미등장으로 처리하지 않습니다.
13. 사진 관련성이 일정 수준 이상인 장소만 최종 추천 후보로 사용합니다.
14. 리뷰 수의 최적 기준은 고정하지 않고 여러 백분위 점수 구간을 실험하여 결정합니다.
15. 모든 기준값과 가중치는 설정 객체에서 수정할 수 있어야 합니다.
16. 계산 과정과 결과를 설명할 수 있도록 모든 세부 점수와 원본 통계를 반환합니다.

먼저 현재 프로젝트 구조와 기존 장소 데이터 타입을 분석한 뒤, 기존 코드와 충돌하지 않는 방식으로 구현 계획을 제시해 주세요.

이후 `ai` 폴더에 필요한 파일을 생성하거나 수정하고, 다음 내용을 함께 설명해 주세요.

```text
생성하거나 수정한 파일
각 파일의 역할
점수 계산 방식
최근 12개월 관광공사 데이터 처리 방식
실험 실행 방법
테스트 실행 방법
CSV 및 JSON 결과 확인 방법
현재 점수 기준에서 추가로 검토해야 할 한계
```
