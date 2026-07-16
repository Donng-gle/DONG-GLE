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
class KakaoConfig:
    rest_api_key: str
    base_url: str = "https://dapi.kakao.com/v2/local"


def get_kakao_config() -> KakaoConfig:
    rest_api_key = os.getenv("KAKAO_REST_API_KEY", "").strip()
    if not rest_api_key:
        raise ValueError("KAKAO_REST_API_KEY is required")

    return KakaoConfig(rest_api_key=rest_api_key)
