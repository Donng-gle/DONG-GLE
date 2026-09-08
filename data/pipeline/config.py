from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class TourApiConfig:
    service_key: str
    mobile_os: str
    mobile_app: str
    base_url: str = "https://apis.data.go.kr/B551011/KorService2"
    region_code: str = "47"
    sigungu_code: str = "170"
    page_size: int = 100
    content_type_ids: tuple[int, ...] = (12, 14, 15, 28, 38, 39)


def get_tourapi_config() -> TourApiConfig:
    service_key = os.getenv("TOURAPI_KEY", "").strip()
    if not service_key:
        raise ValueError("TOURAPI_KEY is required")

    return TourApiConfig(
        service_key=service_key,
        mobile_os=os.getenv("TOURAPI_MOBILE_OS", "ETC").strip() or "ETC",
        mobile_app=os.getenv("TOURAPI_MOBILE_APP", "DONG-GLE").strip() or "DONG-GLE",
    )


@dataclass(frozen=True)
class GoogleConfig:
    api_key: str
    base_url: str = "https://maps.googleapis.com/maps/api/place"


def get_google_config() -> GoogleConfig:
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GOOGLE_MAPS_API_KEY is required")

    return GoogleConfig(api_key=api_key)


@dataclass(frozen=True)
class KakaoConfig:
    rest_api_key: str
    base_url: str = "https://dapi.kakao.com/v2/local"


def get_kakao_config() -> KakaoConfig:
    rest_api_key = os.getenv("KAKAO_REST_API_KEY", "").strip()
    if not rest_api_key:
        raise ValueError("KAKAO_REST_API_KEY is required")

    return KakaoConfig(rest_api_key=rest_api_key)


def get_image_proxy_base_url() -> str:
    # Google Places 사진 URL은 API 키가 필요해 DB에 직접 저장할 수 없어서,
    # 백엔드가 제공하는 프록시(GET /images/proxy?ref=photo_reference)를 거쳐야 한다.
    # (2026-08-03 decision-log 참고)
    base_url = os.getenv("IMAGE_PROXY_BASE_URL", "").strip()
    if not base_url:
        raise ValueError("IMAGE_PROXY_BASE_URL is required")
    return base_url.rstrip("/")
