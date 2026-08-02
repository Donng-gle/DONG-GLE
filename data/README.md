# 데이터 파이프라인

동글 데이터 파트의 목적은 TourAPI 원천 데이터를 수집하고, 검증한 뒤, 서비스 DB 스키마에 맞게 적재하는 것입니다.

## 목표

- 재실행 가능한 수집 파이프라인
- 원천 데이터(raw)와 서비스 적재 로직 분리
- 적재 전후 검증 가능 구조 확보

## 현재 구조

```text
data/
├── README.md
├── requirements.txt
├── .env.example
└── pipeline/
    ├── __init__.py
    ├── config.py        # TourAPI 설정
    ├── db.py            # DB 연결 (DATABASE_URL)
    ├── paths.py         # raw 파일 경로
    ├── fetch_places.py  # areaBasedList2 수집
    ├── fetch_detail.py  # detailCommon2 / detailImage2 / detailIntro2(축제 날짜) 수집
    ├── validate_places.py
    ├── fetch_restaurant_tel.py # Google Places API로 음식점 tel 보완
    └── load_places.py   # PLACE / PLACE_IMAGE DB 적재 (content_id 기준 upsert)
```

## 환경변수

`.env` 파일을 만들어 아래 값을 넣습니다.

- `TOURAPI_KEY`
- `TOURAPI_MOBILE_OS`
- `TOURAPI_MOBILE_APP`
- `DATABASE_URL` (`load_places.py` 실행 시 필요, 예: `postgresql://user:password@host:5432/dongle`)
- `GOOGLE_MAPS_API_KEY` (`fetch_restaurant_tel.py` 실행 시 필요, Places API 활성화 필요)

## 실행 순서

```bash
cd data
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 1단계: 장소 목록 수집
python -m pipeline.fetch_places     # → raw/tourapi/places.json

# 2단계: 수집 결과 검증
python -m pipeline.validate_places  # contentid / title / mapx / mapy 누락 확인

# 3단계: 상세 정보 수집 (overview, homepage, 추가 이미지, 행사 날짜)
python -m pipeline.fetch_detail     # → raw/tourapi/detail_common.json
                                    #    raw/tourapi/detail_images.json
                                    #    raw/tourapi/festival_dates.json

# 4단계 (선택): 음식점 tel Google Places API로 보완 (TourAPI tel 누락 보정)
python -m pipeline.fetch_restaurant_tel  # → raw/tel/restaurant_tel.json

# 5단계: DB 적재 (PLACE / PLACE_IMAGE, content_id 기준 upsert, 재실행해도 안전)
python -m pipeline.load_places
```

## 다음 단계

- 쇼핑(contentTypeId=38) 27건 category 매핑 팀 결정 (`docs/milestone.md` M0 참고) → 결정되면 `load_places.py`의 `CONTENT_TYPE_CATEGORY` 반영
- `GOOGLE_MAPS_API_KEY` 설정 후 `fetch_restaurant_tel.py` 실행 → 음식점 tel 채워서 재적재
- 감성태그 분석 파이프라인 & `PLACE_EMOTION_TAG` 적재 (M2)
