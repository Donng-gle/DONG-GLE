from place_recommender.hidden_score_lookup import StaticHiddenScoreLookup


def test_static_lookup_defaults_missing_ids_to_zero() -> None:
    lookup = StaticHiddenScoreLookup({"1": 80.0})
    assert lookup.get_scores(["1", "2"]) == {"1": 80.0, "2": 0.0}
