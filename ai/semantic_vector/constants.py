"""태그 순서 및 그룹 상수."""

MAJOR_TAG_ORDER = [
    "relaxing",
    "lively",
    "romantic",
    "local",
    "photogenic",
    "traditional",
    "modern",
]

DETAIL_TAG_ORDER = [
    "quiet",
    "peaceful",
    "spacious",
    "nature_friendly",
    "stay_long",
    "crowded",
    "energetic",
    "colorful",
    "dynamic",
    "social",
    "warm_mood",
    "intimate",
    "date_friendly",
    "night_mood",
    "emotional",
    "local_identity",
    "daily_life",
    "authentic",
    "market_alley",
    "hidden_gem",
    "scenic",
    "composition",
    "landmark",
    "viewpoint",
    "photo_spot",
    "traditional_architecture",
    "historical",
    "cultural",
    "natural_material",
    "heritage_mood",
    "modern_architecture",
    "minimal",
    "urban",
    "trendy",
    "artistic",
]

DETAIL_TAG_GROUPS = {
    "relaxing": DETAIL_TAG_ORDER[0:5],
    "lively": DETAIL_TAG_ORDER[5:10],
    "romantic": DETAIL_TAG_ORDER[10:15],
    "local": DETAIL_TAG_ORDER[15:20],
    "photogenic": DETAIL_TAG_ORDER[20:25],
    "traditional": DETAIL_TAG_ORDER[25:30],
    "modern": DETAIL_TAG_ORDER[30:35],
}

DEFAULT_COLLECTION_NAME = "place_semantic_vectors"
DEFAULT_IMAGES_PER_PLACE = 3
