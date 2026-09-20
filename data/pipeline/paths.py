from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent
DATA_ROOT = PACKAGE_ROOT.parent
RAW_ROOT = DATA_ROOT / "raw"
TOURAPI_ROOT = RAW_ROOT / "tourapi"
TEL_ROOT = RAW_ROOT / "tel"
GOOGLE_ROOT = RAW_ROOT / "google"
KAKAO_ROOT = RAW_ROOT / "kakao"
TOURAPI_ROOT.mkdir(parents=True, exist_ok=True)
TEL_ROOT.mkdir(parents=True, exist_ok=True)
GOOGLE_ROOT.mkdir(parents=True, exist_ok=True)
KAKAO_ROOT.mkdir(parents=True, exist_ok=True)
