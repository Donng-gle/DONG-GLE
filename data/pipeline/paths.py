from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent
DATA_ROOT = PACKAGE_ROOT.parent
RAW_ROOT = DATA_ROOT / "raw"
TOURAPI_ROOT = RAW_ROOT / "tourapi"
TOURAPI_ROOT.mkdir(parents=True, exist_ok=True)
