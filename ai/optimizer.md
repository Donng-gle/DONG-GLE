Course Optimizer --- Independent Route Generation & Blind Cross-Evaluation

1. 실험 목적

현재 Course Optimizer가 최종적으로 선택하는 Top-1 코스가 실제로 좋은
코스인지 검증한다.

이번 실험의 핵심 질문은 다음과 같다.

현재 Optimizer의 scoring 공식이나 결과를 전혀 모르는 독립적인
LLM들에게 동일한 여행 정보와 평가 기준을 제공했을 때, 이들이 선택하는
최선의 코스가 Optimizer의 Top-1과 유사한가? 또한 서로가 만든 코스를
익명으로 비교했을 때 Optimizer의 코스가 좋은 코스로 평가되는가?

이번 실험은 Optimizer의 일관성(stability)을 다시 측정하는 실험이
아니다. 또한 Travel-only와 비교하여 이동 가중치를 조정하는 실험도
아니다.

검증 대상은 오직 다음이다.

현재 Optimizer가 생성하는 Top-1의 품질(Quality)

2. 배경

현재 Optimizer는 후보 장소에 대해 다음 요소를 평가하고 코드의 고정된
공식으로 최종 점수를 계산한다.

사용자 선호 적합도

Time 적합도

Transition 적합도

Activity / Rest Balance

이동 효율(Travel)

운영시간 및 일정 제약

즉, 최종 Top-1은 LLM이 직접 전체 경로를 선택한 결과가 아니라,

장소 정보 / VLM Feature
        ↓
LLM Component Evaluation
        ↓
5-Level → Numeric Mapping
        ↓
Optimizer Formula
        ↓
Feasible Route Scoring
        ↓
Top-1

의 결과이다.

따라서 현재 공식이 실제로 좋은 여행 코스를 모델링하고 있는지 확인하기
위해서는 이 공식을 모르는 독립적인 모델의 판단과 비교할 필요가 있다.

3. 핵심 실험 구조

이번 품질 검증은 두 단계로 나눈다.

Experiment A
Independent Route Generation
        ↓
Optimizer / GPT / Gemini가
각자 독립적으로 최선의 경로 생성
        ↓
경로 간 유사도 분석

Experiment B
Blind Cross-Evaluation
        ↓
세 경로의 출처를 숨김
        ↓
독립 Judge들이 각 경로 평가
        ↓
Optimizer Route가 실제로 지지되는지 확인

두 실험의 질문은 서로 다르다.

Experiment A

독립적인 모델들도 현재 Optimizer와 비슷한 최적 경로를 선택하는가?

Experiment B

경로 생성 방식이 다르더라도, 결과들을 직접 비교하면 현재 Optimizer의
경로가 좋은 경로로 평가되는가?

4. 공통 입력 조건

Optimizer와 독립 생성 모델에는 동일한 원본 정보를 제공한다.

예:

사용자 여행 선호

후보 장소 목록

장소 category

장소별 특징 / 분위기 정보

VLM 기반 장소 설명 또는 feature

장소별 예상 체류시간

장소별 운영시간

장소 간 실제 이동시간

여행 시작 시간

여행 종료 시간

이동수단

출발지 / 도착지 조건

기타 feasibility 조건

중요한 원칙은 정보의 비대칭을 만들지 않는 것이다.

GPT와 Gemini가 Optimizer보다 적은 장소 정보를 받으면 공정한 비교가
아니므로, 코스를 판단하는 데 필요한 원본 feature는 가능한 한 동일하게
제공한다.

5. 독립 모델에게 제공할 평가 기준

독립 모델에게 Optimizer의 공식은 알려주지 않지만, 무엇을 좋은 여행
코스로 볼 것인지는 알려준다.

공통 평가 기준:

Preference Fit

사용자의 여행 취향과 장소 구성이 잘 맞는가?

Time Suitability

각 장소가 방문되는 시간대와 장소의 특성이 잘 맞는가?

Transition Quality

연속된 장소 사이의 경험 및 분위기 전환이 자연스러운가?

Activity / Rest Balance

활동적인 경험과 휴식성 경험이 하루 동안 적절하게 배치되는가?

Travel Efficiency

불필요한 왕복이나 지나치게 긴 이동 없이 동선이 효율적인가?

Schedule Feasibility

운영시간, 체류시간, 이동시간을 고려했을 때 실제 수행 가능한
일정인가?

Overall Experience

위 요소를 종합했을 때 실제 사용자에게 추천할 만한 하루 여행
코스인가?

중요한 제한

독립 모델에는 다음 정보를 절대 제공하지 않는다.

Optimizer의 최종 공식

각 component의 가중치

5-Level → Numeric mapping

Optimizer의 component score

Optimizer의 TotalScore

Optimizer의 route rank

Optimizer Top-1이 어떤 경로인지

다른 모델이 선택한 경로

즉, 독립 모델은 현재 시스템의 판단에 영향을 받지 않고 원본 정보만으로
최선의 경로를 결정한다.

6. Experiment A --- Independent Route Generation

6.1 목적

동일한 여행 조건을 받은 서로 다른 방법이 독립적으로 어떤 Top-1 경로를
선택하는지 확인한다.

6.2 비교 대상

A. Current Optimizer

현재 production/evaluation Optimizer를 그대로 사용한다.

기존 scoring model

기존 5-Level prompt

기존 mapping

기존 formula

기존 weights

기존 feasibility / backtracking

기존 Travel 계산

수정하지 않는다.

결과:

Optimizer → Route A

B. Independent GPT

Optimizer 공식 및 결과를 모르는 GPT 모델에게 동일한 원본 정보를
제공한다.

요청:

주어진 후보 장소와 여행 조건을 이용하여 전체 여행 경험이 가장 좋다고
판단되는 경로 하나만 선택하라.

결과:

GPT → Route B

C. Independent Gemini

GPT와 동일한 입력 정보와 평가 기준을 제공한다.

Optimizer 결과 및 GPT 결과는 공개하지 않는다.

결과:

Gemini → Route C

6.3 독립 생성 Prompt 원칙

프롬프트는 특정 Optimizer 공식으로 모델을 유도하지 않는다.

예시:

다음은 하루 여행을 위한 후보 장소와 여행 조건이다.

주어진 장소 중 실제 일정 안에 방문 가능한 장소를 선택하고
방문 순서를 구성하여 가장 좋은 여행 코스 하나를 만들어라.

다음을 종합적으로 고려하라.

- 사용자 취향과 장소의 적합성
- 방문 시간대와 장소의 적합성
- 연속된 장소 사이의 경험/분위기 전환
- 활동과 휴식의 균형
- 실제 이동시간과 동선 효율
- 운영시간과 일정의 현실성
- 하루 전체 여행 경험의 완성도

특정 요소 하나만 극단적으로 최적화하지 말고,
전체 여행 경험이 가장 좋은 경로 하나를 선택하라.

반드시 제공된 데이터만 사용하라.
내부적으로 비교한 뒤 최종 경로 하나만 확정하라.

7. Experiment A 평가 지표

단순 Exact Match만으로 판단하지 않는다.

예:

Optimizer
A → B → C → D → E → F → G

GPT
A → B → C → D → E → G → F

두 경로는 Exact Match는 아니지만 사실상 매우 유사하다.

따라서 다음 지표를 함께 사용한다.

7.1 Exact Route Match

전체 장소와 순서가 완전히 동일한지 확인한다.

ExactMatch = 1 if route_optimizer == route_model else 0

가장 엄격한 지표이므로 보조적으로 사용한다.

7.2 Place Set Overlap

두 코스가 얼마나 동일한 장소를 선택했는지 측정한다.

Jaccard Similarity:

PlaceSetSimilarity(A, B)
= |Places(A) ∩ Places(B)|
  -----------------------
  |Places(A) ∪ Places(B)|

예:

Optimizer = {A,B,C,D,E,F,G}
GPT       = {A,B,C,D,E,F,H}

intersection = 6
union        = 8

similarity = 0.75

7.3 Order Similarity

공통으로 선택한 장소들의 방문 순서가 얼마나 유사한지 측정한다.

가능한 지표:

Kendall rank correlation

Pairwise order agreement

normalized sequence similarity

이번 실험에서는 공통 장소 pair의 상대 순서가 동일한 비율을 기본 지표로
사용한다.

7.4 Prefix Agreement

여행 초반의 선택이 얼마나 일치하는지도 확인한다.

예:

First place match

Top-2 prefix

Top-3 prefix

이는 전체 순서는 조금 달라도 주요 일정 구조가 같은지를 확인하기
위함이다.

7.5 Time-position Similarity

동일 장소가 비슷한 시간대에 배치되는지 확인한다.

예:

Optimizer: 태사묘 → morning
GPT:       태사묘 → morning

match

시간대는 프로젝트에서 사용하는 구간에 맞춘다.

예:

morning

lunch

afternoon

evening

7.6 Travel Comparison

각 모델이 선택한 경로의 총 이동시간을 비교한다.

Optimizer Travel
GPT Travel
Gemini Travel

단, 가장 짧은 경로를 자동으로 가장 좋은 코스로 판단하지 않는다.

Travel은 전체 품질의 한 요소로만 분석한다.

8. Experiment A 결과 형식

예시:

Metric                       Optimizer vs GPT   Optimizer vs Gemini

Exact route match                           0                     0
Place-set similarity                     1.00                  0.86
Order similarity                         0.92                  0.81
First-place match                           1                     1
Top-2 prefix                             1.00                  0.50
Top-3 prefix                             1.00                  0.67
Time-position similarity                 0.86                  0.71
Travel difference                      +1 min                -2 min

9. Experiment A 해석

Case A --- 높은 생성 일치

GPT와 Gemini 모두 Optimizer와 높은 place/order similarity를 보인다.

해석:

현재 Optimizer가 선택한 경로가 서로 다른 독립 모델의 최적 경로
판단과도 대체로 일치한다.

Case B --- 장소는 같고 순서만 다름

Place-set similarity는 높지만 Order similarity가 낮다.

해석:

어떤 장소를 방문해야 하는지에 대해서는 합의가 있지만 최적 방문 순서는
모호하다.

이 경우 Transition / Time / Travel 순서 결정 로직을 별도로 분석한다.

Case C --- 장소 구성 자체가 다름

GPT/Gemini가 다른 장소 집합을 선택한다.

해석:

현재 Optimizer와 독립 모델 사이에 좋은 여행 코스의 구성 자체에 대한
판단 차이가 존재한다.

이 경우 바로 Optimizer를 수정하지 않고 Experiment B에서 실제 품질 선호를
확인한다.

10. Experiment B --- Blind Cross-Evaluation

10.1 목적

Experiment A에서 생성된 서로 다른 경로의 출처를 숨긴 상태에서 직접
품질을 비교한다.

핵심 질문:

생성 방식이 서로 달라도, 독립 Judge들이 현재 Optimizer의 경로를 좋은
경로로 평가하는가?

10.2 평가 대상

Experiment A의 세 경로를 사용한다.

Optimizer Route
GPT Route
Gemini Route

단, Judge에게는 다음처럼 익명화한다.

Course X
Course Y
Course Z

각 repeat마다 라벨 순서를 무작위로 섞는다.

Judge는 어떤 경로가

Optimizer 결과인지

GPT 결과인지

Gemini 결과인지

알 수 없어야 한다.

11. Judge 구성

최소 두 개의 서로 다른 독립 Judge를 사용한다.

예:

Judge 1 → GPT 계열
Judge 2 → Gemini 계열

가능하면 추가로 제3 모델을 사용한다.

중요한 점:

자신이 생성한 코스를 자신이 평가하는 self-preference 가능성이
있으므로 결과를 모델별로 분리해서 기록한다.

예:

GPT Judge:
Course X > Course Z > Course Y

Gemini Judge:
Course X > Course Y > Course Z

최종 결론은 특정 Judge 하나가 아니라 Judge 간 합의를 중심으로
판단한다.

12. Blind Judge 평가 기준

각 코스에 대해 다음 항목을 1~5점으로 평가한다.

Criterion               설명

Preference Fit          사용자 취향에 적합한가
Time Suitability        시간대 배치가 적절한가
Transition Quality      장소 간 경험 전환이 자연스러운가
Activity/Rest Balance   활동과 휴식이 적절히 배치됐는가
Travel Efficiency       동선이 효율적인가
Schedule Feasibility    실제 수행 가능한가
Overall Quality         실제 추천할 만한 완성도인가

그리고 마지막에 반드시:

BEST_COURSE = X / Y / Z

중 하나를 선택하게 한다.

동점이라고 판단할 경우에도 실제 사용자에게 하나만 추천해야 한다는
조건으로 최종 선택하게 한다.

13. Judge Prompt 원칙

Judge에게 다음은 보여준다.

동일한 사용자 조건

동일한 후보 장소 정보

각 코스의 방문 순서

예상 방문 시각

장소별 체류시간

구간별 이동시간

전체 이동시간

운영시간/feasibility 정보

반면 다음은 숨긴다.

코스 생성 모델

Optimizer score

Optimizer rank

component score

공식

가중치

"기존 Top-1"이라는 표현

예시:

다음 세 코스는 동일한 사용자와 동일한 후보 장소를 기반으로 생성되었다.

각 코스의 생성 방식과 출처는 공개되지 않는다.

다음 기준으로 각 코스를 독립적으로 평가하라.

1. 사용자 선호 적합성
2. 시간대 적합성
3. 장소 간 경험 전환
4. 활동/휴식 균형
5. 이동 효율
6. 일정 현실성
7. 전체 여행 경험

각 항목을 1~5점으로 평가하고,
마지막에는 실제 사용자에게 하나만 추천해야 한다면
어떤 코스를 선택할지 반드시 하나를 결정하라.

코스의 제시 순서에 영향을 받지 말고 내용만 평가하라.

14. Experiment B 핵심 지표

14.1 Optimizer Route Win Rate

OptimizerWinRate
= Optimizer Route가 BEST_COURSE로 선택된 횟수
  ------------------------------------------
             전체 Judge 평가 횟수

14.2 Judge별 Optimizer Win Rate

GPT Judge와 Gemini Judge 결과를 분리한다.

예:

Judge            Optimizer   GPT Route   Gemini Route

GPT Judge              70%         20%            10%
Gemini Judge           60%         10%            30%

14.3 Overall Quality

각 코스의 평균 Overall Quality를 비교한다.

예:

Course        Overall

Optimizer         4.6
GPT               4.3
Gemini            4.4

14.4 Criterion별 차이

Optimizer가 어떤 부분에서 강하거나 약한지 확인한다.

예:

Criterion       Optimizer   GPT   Gemini

Preference            4.5   4.4      4.3
Time                  4.8   4.5      4.6
Transition            4.6   4.2      4.5
Balance               4.4   4.3      4.5
Travel                4.1   4.5      4.3
Feasibility           5.0   4.8      4.9
Overall               4.6   4.3      4.4

14.5 Judge Agreement

Judge들이 BEST_COURSE에 얼마나 합의하는지 확인한다.

단순 비율 또는 modal share를 기록한다.

예:

Optimizer selected = 16
GPT selected       = 2
Gemini selected    = 2

modal share = 16 / 20 = 0.80

15. 반복 횟수

LLM의 단일 판단에 의존하지 않도록 반복 평가한다.

권장 초기 설정:

Independent generation:
- GPT: 10회
- Gemini: 10회

Blind Cross-Evaluation:
- GPT Judge: 10회
- Gemini Judge: 10회

단, 비용이 부담되면 우선 generation을 모델당 5회 수행하고 결과 분포를
확인한 뒤 확대한다.

독립 생성 자체가 흔들리는 경우에는 각 모델의 modal Top-1을 해당
모델의 대표 코스로 사용한다.

예:

GPT generation 10회

Route B = 8회
Route D = 1회
Route E = 1회

→ GPT representative = Route B

Optimizer 역시 기존 stability 실험에서 확인한 modal Top-1을 대표 코스로
사용할 수 있다.

16. 전체 실험 흐름

                    동일 원본 입력
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     Optimizer        GPT Generator   Gemini Generator
          │              │              │
          ▼              ▼              ▼
       Route A         Route B         Route C
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
               Experiment A 분석
          Place / Order / Time similarity
                         │
                         ▼
              Route 출처 완전 익명화
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
         GPT Judge               Gemini Judge
             │                       │
             └───────────┬───────────┘
                         ▼
                Experiment B 분석
           Absolute scores + BEST_COURSE
                         │
                         ▼
                 최종 Quality 판정

17. 최종 판정 기준

Case A --- Strong Validation

다음이 동시에 나타난다.

Independent generation에서 Optimizer와 높은 유사도

Blind evaluation에서 Optimizer Route가 가장 자주 선택됨

Overall Quality도 Optimizer가 가장 높거나 동급

서로 다른 Judge가 같은 결론을 지지함

해석:

현재 Optimizer의 Top-1은 독립적인 강한 모델들의 생성 및 평가
기준에서도 좋은 여행 코스로 지지된다.

이 경우 현재 Top-1 품질은 충분히 검증된 것으로 보고 일관성 개선 단계로
이동한다.

Case B --- Different Generation, Optimizer Wins Evaluation

GPT/Gemini가 직접 생성한 경로는 Optimizer와 다르지만, blind
comparison에서는 Optimizer가 가장 많이 선택된다.

해석:

최적 경로를 생성하는 방식에는 차이가 있지만, 결과를 직접 비교하면 현재
Optimizer 결과의 품질이 독립 모델들에 의해 지지된다.

이 역시 긍정적인 결과다.

Case C --- Similar Generation, No Clear Winner

경로는 대체로 비슷하지만 Blind Judge의 선호가 갈린다.

해석:

후보 경로들이 실제로 near-equivalent할 가능성이 높다.

이 경우 Top-1 exact match 자체를 절대적인 품질 기준으로 보지 않는다.

Case D --- Optimizer Loses Blind Evaluation

독립 모델들이 만든 코스가 Blind Judge에서 지속적으로 더 높은 평가를
받는다.

해석:

현재 Optimizer가 안정적으로 코스를 생성하더라도, scoring 공식이 실제
여행 품질을 충분히 반영하지 못할 가능성이 있다.

이 경우에만 다음 단계로:

component ablation

Experience / Travel 분석

weight sweep

Transition scoring 재검토

Time scoring 재검토

등을 수행한다.

18. 이번 실험에서 Travel-only를 핵심 비교에서 제외하는 이유

이번 실험의 질문은

"현재 Optimizer가 최단 이동 경로보다 좋은가?"

가 아니다.

질문은

"현재 Optimizer가 독립적인 모델들이 판단하는 좋은 여행 코스와
일치하며, 그 결과 자체가 좋은 코스인가?"

이다.

따라서 Travel-only는 이번 핵심 품질 실험에서 제외한다.

Travel-only는 이후 scoring 진단 단계에서 다음 질문을 검증할 때
baseline으로 사용한다.

Experience 최적화를 위해 추가 이동을 감수하는 것이 실제 품질 향상을
만들어내는가?

즉:

현재 단계:
Optimizer Top-1의 Quality 검증

후속 단계:
왜 좋은가 / 왜 나쁜가 분석
→ Travel-only
→ Random
→ Ablation
→ Weight sweep

순서로 분리한다.

19. 실험 통제 조건

이번 실험 동안 기존 Optimizer는 freeze한다.

수정 금지:

production prompt

5-Level 정의

mapping

component formula

final scoring formula

weights

candidate generation

feasibility 조건

backtracking

scoring LLM

이번 실험은 Optimizer 개선 실험이 아니라 품질 검증 실험이다.

결과가 나오기 전에 Optimizer를 수정하면 무엇을 검증하는지 불분명해진다.

20. 반드시 기록할 결과

Experiment A

Optimizer representative Top-1

GPT generation 전체 분포

GPT modal Top-1

Gemini generation 전체 분포

Gemini modal Top-1

Exact Match

Place-set similarity

Order similarity

Prefix agreement

Time-position similarity

총 이동시간

feasibility

Experiment B

익명 Course label mapping (평가 종료 후에만 공개)

Judge별 criterion score

Judge별 BEST_COURSE

Optimizer Route win rate

GPT Route win rate

Gemini Route win rate

Judge agreement

Overall Quality 평균

criterion별 평균

모델별 self-preference 여부

21. 최종 결과 표 Template

Independent Generation

Metric                       Optimizer vs GPT   Optimizer vs Gemini

Exact Match
Place-set similarity
Order similarity
First-place match
Top-2 prefix
Top-3 prefix
Time-position similarity
Travel difference

Blind Cross-Evaluation

Metric               Optimizer Route   GPT Route   Gemini Route

Preference
Time
Transition
Balance
Travel
Feasibility
Overall
BEST_COURSE wins

Judge별 Winner

Judge            Optimizer Route   GPT Route   Gemini Route

GPT Judge
Gemini Judge
Total

22. 최종 질문

실험 종료 후 반드시 다음 질문에 답한다.

GPT가 독립적으로 생성한 최적 경로는 Optimizer와 얼마나 유사한가?

Gemini가 독립적으로 생성한 최적 경로는 Optimizer와 얼마나 유사한가?

세 방식이 동일한 장소 집합을 선택하는가?

장소는 같지만 순서만 다른가?

시간대 배치는 얼마나 유사한가?

GPT Judge는 어떤 경로를 가장 많이 선택하는가?

Gemini Judge는 어떤 경로를 가장 많이 선택하는가?

Judge 간 BEST_COURSE 합의가 존재하는가?

Optimizer Route의 blind win rate는 얼마인가?

Optimizer Route의 Overall Quality는 다른 두 경로보다 높은가?

Optimizer가 가장 강한 평가 기준은 무엇인가?

Optimizer가 가장 약한 평가 기준은 무엇인가?

독립 생성 결과와 blind evaluation 결과가 같은 결론을 지지하는가?

특정 모델이 자신이 생성한 경로를 과도하게 선호하는 self-preference가
보이는가?

현재 Top-1을 "좋은 코스"라고 판단할 근거가 충분한가?

다음 단계가 stability 개선인가, scoring 재설계인가?

23. 최종 의사결정

Quality 검증 성공
    ↓
현재 Top-1을 품질 기준점으로 유지
    ↓
Top-1 일관성 개선
    ↓
최종 Human Evaluation


Quality 검증 실패
    ↓
현재 Top-1을 안정화하지 않음
    ↓
왜 독립 모델 경로보다 낮게 평가됐는지 분석
    ↓
Ablation / Weight / Scoring 재설계
    ↓
Quality 재검증
    ↓
Stability 개선

핵심 원칙:

좋지 않은 결과를 일관되게 만드는 것은 의미가 없다.

따라서 현재 단계에서는 먼저 Optimizer Top-1의 독립적 품질 검증을
완료하고, 품질이 확인된 이후 그 결과의 일관성을 추가로 개선한다.

24. 이번 실험의 한 줄 정의

Optimizer의 공식을 모르는 GPT와 Gemini가 동일한 여행 정보를 바탕으로
독립적으로 최적 코스를 생성하게 하고, 세 코스를 다시 익명으로 교차
평가하여 현재 Optimizer Top-1이 실제로 좋은 여행 코스인지 검증한다.