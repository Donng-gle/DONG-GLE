# 안동 Hidden Score 설계 및 실험 계획 (Blind Rating 방식)

Google Places API + GPT API를 활용해 안동 지역 "숨은 명소(Hidden Gem)" 판단 기준을
**리뷰수를 GPT에게 숨긴 블라인드 평가**를 통해 통계적으로 도출하는 실험 계획.

---

## 0. 핵심 아이디어

기존 방식(리뷰수를 보여주고 GPT가 직접 hidden 여부를 판단)은 GPT가 리뷰수 숫자
자체에 대한 편향된 사전지식(선입견)을 갖고 판단할 위험이 있음.

대신:
1. GPT에게는 **리뷰수를 완전히 가리고** 사진 / 설명 / 대표 리뷰 텍스트만 보여준다.
2. GPT는 오직 그 정성적 정보만으로 **Hiddenness(숨겨진 정도)**와 **Worthiness(가볼
   만한 가치)**를 1~5로 평가한다.
3. 평가가 끝난 뒤 **별도로 보관해둔 실제 review_count와 GPT의 Hiddenness 점수 사이의
   상관관계**를 분석한다.
4. 그 상관관계(회귀식/분포)로부터 "실제로 리뷰수가 몇 개일 때 Hiddenness가 높게
   나오는가"를 역산해 μ, σ를 추정한다.

즉 GPT는 "리뷰수를 모르는 상태에서 순수하게 느껴지는 숨겨진 정도"를 라벨링하는
**독립적인 평가자(rater)** 역할만 하고, 리뷰수와의 관계는 사후에 통계적으로
검증한다. 이게 GPT의 사전 편향을 배제하고 데이터 기반으로 μ, σ를 얻을 수 있어
기존 방식보다 통계적으로 더 자연스럽다.

---

## 1. 전체 파이프라인

```
[1] Google Places API로 안동 장소 데이터 수집
    (사진, 설명, 대표 리뷰, rating, user_ratings_total 모두 수집하되
     user_ratings_total은 GPT에게 절대 노출하지 않고 별도 보관)
        ↓
[2] GPT에 "사진 + 설명 + 대표 리뷰"만 전달
    → Hiddenness(1~5), Worthiness(1~5) 평가 요청
        ↓
[3] 평가 결과(Hiddenness, Worthiness)와 숨겨뒀던 review_count를 매칭
        ↓
[4] review_count ↔ Hiddenness 상관관계 분석 (산점도, 회귀, 구간별 평균)
        ↓
[5] 관계식으로부터 μ, σ 추정
        ↓
[6] 최종 hidden_score 함수 확정 (Worthiness는 평점 대체/보완 지표로 결합)
```

---

## 2. Step 1 — 데이터 수집 (Google Places API)

### 수집 필드
| 필드 | 용도 | GPT에 노출? |
|---|---|---|
| place_id, name | 식별용 | X (place_id는 매칭용 내부 키로만 사용) |
| photos (사진 URL/이미지) | GPT 입력 | O |
| editorial_summary / description | GPT 입력 | O |
| reviews (텍스트 상위 N개, 대표 리뷰) | GPT 입력 | O |
| rating | 참고/차후 분석용 | X (Hiddenness 판단 단계에서는 미노출 권장) |
| **user_ratings_total (리뷰수)** | **정답 라벨로 별도 보관** | **X — 절대 노출 금지** |

> rating도 노출하면 GPT가 "평점 높다 = 이미 알려짐" 같은 유추를 할 수 있으므로,
> Hiddenness/Worthiness 평가 단계에서는 rating도 같이 가리는 것을 권장.
> (Worthiness를 GPT가 사진/리뷰만으로 새로 매기게 하는 것이 이 실험의 취지와도 맞음)

### 대표 리뷰 선정 방법
- Place Details API의 `reviews` 필드에서 최대 5개 반환됨 (Google 정책상 개수 제한 있음)
- 가능하면 최근 리뷰 + 도움됨(helpful) 순 상위 리뷰를 우선 사용
- 리뷰 텍스트에 리뷰수/방문객 수를 암시하는 문구("여기 이렇게 사람 많은지 몰랐어요",
  "SNS에서 유명해서 왔어요" 등)가 있으면 힌트가 될 수 있어 완전한 블라인드가 아님을
  인지할 것 (한계점으로 문서화, 8절 참고)

### 산출물
`raw_places_andong.json`
```json
{
  "place_id": "...",
  "name": "...",
  "photos": ["url1", "url2"],
  "description": "...",
  "top_reviews": ["리뷰텍스트1", "리뷰텍스트2", "..."],
  "_hidden_labels": {
    "rating": 4.5,
    "user_ratings_total": 87
  }
}
```
`_hidden_labels`는 GPT 프롬프트 생성 코드에서 절대 참조하지 않도록 별도 키로 분리
(실수로 프롬프트에 섞여 들어가는 것을 코드 레벨에서 방지).

---

## 3. Step 2 — GPT 블라인드 평가 (Hiddenness / Worthiness)

### 입력 (place당 1회 평가, 리뷰수/평점 미포함)
```json
{
  "name": "장소A",
  "photos": ["이미지 첨부"],
  "description": "...",
  "top_reviews": ["...", "..."]
}
```

### 프롬프트 템플릿
```
당신은 여행 콘텐츠 평가 전문가입니다.
아래 장소의 사진, 설명, 방문자들이 남긴 대표 리뷰만 보고 평가하세요.
이 장소가 얼마나 많이 알려져 있는지, 평점이 몇 점인지에 대한 정보는
의도적으로 제공하지 않았습니다. 오직 주어진 정보만으로 판단하세요.

[장소명]: {name}
[설명]: {description}
[대표 리뷰]:
{top_reviews 나열}
[사진]: (첨부)

다음 두 항목을 1~5점으로 평가하세요.

1. Hiddenness (숨겨진 정도): 이 장소가 대중적으로 잘 알려지지 않은,
   숨겨진 느낌을 주는 정도. 1 = 누구나 아는 유명 관광지 같다,
   5 = 아무도 모르는 나만 아는 곳 같다.

2. Worthiness (방문 가치): 사진/설명/리뷰 내용만 봤을 때 실제로
   가볼 만한 가치가 있어 보이는 정도. 1 = 별로다, 5 = 매우 가볼 만하다.

JSON으로만 답하세요:
{"hiddenness": <1-5>, "worthiness": <1-5>, "reason": "<한 줄 근거>"}
```

### 실행 시 주의
- 멀티모달 입력(사진 포함) 가능한 GPT 모델 사용
- place당 **일관성 확인을 위해 2~3회 반복 평가 후 평균** 사용 권장 (동일 입력, 약간의
  temperature로 변동성 체크)
- `reason` 필드를 받아두면, 혹시 GPT가 리뷰 텍스트에서 인기 힌트를 유추했는지
  사후에 점검 가능 (예: "리뷰에 사람이 많다고 적혀 있어서" 같은 근거가 나오면
  해당 place는 완전 블라인드가 아니었다는 뜻이므로 분석에서 제외 후보로 표시)

### 산출물
`gpt_ratings_andong.json`
```json
{
  "place_id": "...",
  "hiddenness": 4.7,
  "worthiness": 4.2,
  "reason": "..."
}
```

---

## 4. Step 3 — review_count와 매칭

`place_id` 기준으로 Step 1에서 숨겨뒀던 `_hidden_labels.user_ratings_total` 및
`rating`을 Step 2 결과와 join.

```
place_id | hiddenness | worthiness | review_count | rating
---------|-----------|------------|--------------|-------
A        | 4.7       | 4.2        | 40           | 4.6
B        | 1.2       | 3.8        | 1500         | 4.3
...
```

---

## 5. Step 4 — review_count ↔ Hiddenness 상관관계 분석

### 5-1. 시각화
- x축: `log(review_count + 1)`, y축: `hiddenness` 산점도
- 예상 형태: 리뷰수가 늘어날수록 hiddenness가 감소하는 음의 상관 (전 구간 우하향일
  수도, 혹은 특정 구간 이후 급격히 떨어지는 형태일 수도 있음 — 직접 데이터로 확인)

### 5-2. 정량 분석
- Pearson/Spearman 상관계수 (`log(review_count)` vs `hiddenness`)
- 회귀 적합: 단순 선형 회귀 또는 로지스틱/시그모이드 형태 적합
  ```
  hiddenness ≈ a - b * log(review_count + 1)
  ```
  혹은 비선형이 뚜렷하면:
  ```
  hiddenness ≈ 5 / (1 + exp(k * (log(review_count) - x0)))
  ```

### 5-3. 구간별 평균 (binning)
- `log(review_count)`를 몇 개 구간으로 나눠 구간별 hiddenness 평균/표준편차 표로 정리
  (사용자가 예시로 든 "리뷰 40개→4.7 / 리뷰 1500개→1.2" 같은 대응 관계를 표로 확인)

| review_count 구간 | 평균 hiddenness | 표본 수 |
|---|---|---|
| 1~20 | ? | ? |
| 20~50 | ? | ? |
| 50~150 | ? | ? |
| 150~500 | ? | ? |
| 500+ | ? | ? |

---

## 6. Step 5 — μ, σ 추정

목표: `reliability_weight(review_count) = exp(-(log_n - μ)^2 / (2σ^2))` 형태로
쓰기 위한 μ, σ를 **hiddenness가 GPT 기준 가장 높게 나오는 review_count 지점**에서
역산.

### 방법 A — 회귀 곡선의 최고점 사용
- hiddenness가 단조 감소(리뷰수가 적을수록 무조건 hiddenness 높음)로만 나온다면,
  "hiddenness가 높다 = 종 모양 곡선의 정점"이라는 가정이 깨질 수 있음.
  → 이 경우 **너무 리뷰수가 적은 곳(1~5개)은 hiddenness는 높지만 신뢰도가 낮다는
  것**을 별도로 반영해야 함 (아래 6-1 참고)

### 6-1. 만약 hiddenness가 단조 감소로만 나온다면 (종 모양이 아니라면)
- 이는 GPT가 "리뷰수와 무관하게 사진/설명만으로는 신뢰도 문제를 못 느낀다"는 뜻이므로,
  hiddenness 자체는 μ(중심)를 추정하는 데 쓰고, **σ(하한 페널티)는 별도로
  review_count 자체의 절대적 하한선(예: 최소 표본 신뢰 기준)을 통계적으로/휴리스틱하게
  설정**해야 함
- 즉 최종 함수는 두 요소의 곱으로 유지:
  ```
  hidden_component = f(hiddenness_regression(review_count))   # 상한 페널티 (너무 유명함)
  reliability_component = g(review_count)                      # 하한 페널티 (표본 부족)
  ```

### 방법 B — hiddenness ≥ threshold(예: 4.0 이상) 구간의 review_count 분포 사용
- GPT가 hiddenness 4.0 이상으로 평가한 장소들만 골라 그 `log(review_count)`들의
  평균과 표준편차를 각각 μ, σ로 사용
  ```
  μ = mean(log(review_count+1) | hiddenness >= 4.0)
  σ = std(log(review_count+1) | hiddenness >= 4.0)
  ```
- 이 방법이 사용자가 제안한 흐름과 가장 직접적으로 맞닿아 있음: "GPT가 hidden이라고
  느낀 곳들의 실제 리뷰수 분포"로부터 μ, σ를 뽑는 것

---

## 7. Step 6 — 최종 hidden_score 함수

```python
import math

def reliability_weight(review_count, mu, sigma):
    log_n = math.log(review_count + 1)
    return math.exp(-((log_n - mu) ** 2) / (2 * sigma ** 2))

def bayesian_rating(rating, review_count, m, C):
    v = review_count
    return (v / (v + m)) * rating + (m / (v + m)) * C

def hidden_score(rating, review_count, worthiness, mu, sigma, m, C, w1=0.5, w2=0.5):
    br = bayesian_rating(rating, review_count, m, C)   # 실제 구글 평점 기반
    rw = reliability_weight(review_count, mu, sigma)   # Step 5에서 추정한 μ, σ 적용
    # worthiness(GPT가 사진/리뷰만 보고 매긴 가치 점수)를 rating과 앙상블 가능
    combined_quality = w1 * br + w2 * (worthiness)  # 스케일 맞춤 필요 (worthiness 1~5 → 정규화)
    return combined_quality * rw
```

- `worthiness`는 실제 rating과 별개로 "사진/리뷰만 봤을 때의 매력도"를 담고 있어,
  실제 평점과 결합하면 "평점은 낮지만 사진상 매력적인 숨은 명소" 같은 케이스도
  잡아낼 수 있음 (선택적 확장)

---

## 8. 한계 및 주의사항

- **완전한 블라인드가 어려울 수 있음**: 대표 리뷰 텍스트 안에 "사람이 붐빈다",
  "웨이팅이 길다", "SNS 핫플" 같은 문구가 있으면 GPT가 암묵적으로 인기도를 유추함.
  → `reason` 필드에서 이런 유추가 있었는지 점검하고, 해당 place는 분석 시 제외하거나
  별도 그룹으로 표시
- **사진 자체의 정보량 차이**: 유명 관광지는 사진 퀄리티/구도가 좋고 사람이 많이
  찍혀 있어 오히려 "사람 많아 보임 = 유명함"을 사진에서 직접 유추할 위험도 있음
  → 가능하면 사람이 적게 나온 사진 위주로 선별하거나, 이 역시 한계로 문서화
- **표본 수**: 안동 장소 수 자체가 많지 않으므로, GPT 평가 반복 횟수를 늘려
  (place당 2~3회) 평균을 취해 노이즈를 줄이는 것이 특히 중요
- **회귀 형태 가정**: 선형/시그모이드 어느 쪽이 맞을지는 실제 산점도를 보고 결정.
  구간별 평균표(5-3)를 먼저 만들어보고 형태를 확인한 뒤 회귀 모델을 선택할 것

---

## 9. TODO 체크리스트

- [ ] Google Places API 키 발급 및 쿼터 확인
- [ ] 안동 장소 수집 스크립트 (사진 URL, 설명, 대표 리뷰, rating, review_count 수집)
- [ ] `_hidden_labels`(rating, review_count) 별도 분리 저장 로직 구현 (프롬프트 생성 코드와 완전 분리)
- [ ] GPT 블라인드 평가 프롬프트 코드화 (멀티모달 입력 포함)
- [ ] place당 반복 평가(2~3회) 및 평균 로직
- [ ] `reason` 필드 기반 "암묵적 힌트 유추" 필터링 로직
- [ ] review_count ↔ hiddenness 매칭 및 산점도 시각화
- [ ] 상관계수 계산 + 회귀/구간별 평균 분석
- [ ] μ, σ 추정 (방법 A/B 비교)
- [ ] 최종 hidden_score 함수 구현 및 전체 랭킹 산출
- [ ] 한계점(리뷰 텍스트 힌트, 사진 정보량) 반영한 결과 재검토
