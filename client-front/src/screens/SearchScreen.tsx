import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { placeApi } from '../api/place';
import { CircleCloseIcon, LocationPinIcon, SearchIcon } from '../components/icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PlaceListScreen } from './PlaceListScreen';

interface Props {
  onExit: () => void;
}

// Figma "검색창"(362:3204/362:3724, 검색바) + "검색"(362:3254/362:3728, 콘텐츠) 실측 그대로.
// 두 상태: (1) 검색어 없음 — "인기 검색어" 칩 목록 (2) 검색어 있음 — 장소명 자동완성 목록(핀
// 아이콘+일치 구간 굵게). 둘 중 하나를 고르거나 검색을 실행하면 PlaceListScreen(기존 검색 결과
// 화면)으로 넘어감 — 오늘 범위는 이 진입 화면까지로 한정(2026-09-07 결정, decision-log 참고)
//
// "인기 검색어"는 실제 인기도 데이터/API가 없어서(PlaceListScreen이 전에 이미 같은 이유로 자동완성
// 자체를 뺐던 이력 있음) Figma 시안 텍스트를 그대로 하드코딩 — "병상서원"은 시안 오타로 보여서
// 실제 장소명 "병산서원"으로 바로잡음
const POPULAR_KEYWORDS = [
  ['선비순례길', '하회마을', '병산서원', '한옥스테이'],
  ['봉정사', '안동찜닭', '도산서원', '안동댐', '임청각'],
  ['안동소주', '한지 체험', '월영교'],
];

// 자동완성 목록 최대 개수 — Figma 시안이 6개를 보여줘서 그에 맞춤(임의값, 대응 스펙 없음)
const SUGGESTION_LIMIT = 6;

export function SearchScreen({ onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  // 타이핑마다 실제 장소 검색 API로 자동완성 — 대응하는 별도 자동완성 API가 없어서 기존
  // /places/search를 재사용하고 장소명만 뽑아 씀(2026-09-07 결정, decision-log 참고)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    placeApi
      .search(trimmed, 1, SUGGESTION_LIMIT)
      .then((res) => {
        if (!cancelled) setSuggestions(res.places.map((p) => p.name));
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (submittedQuery != null) {
    return <PlaceListScreen onExit={onExit} initialQuery={submittedQuery} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onExit} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <SearchIcon size={20} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="검색어를 입력하세요"
            placeholderTextColor={colors.gray500}
            onSubmitEditing={() => query.trim() && setSubmittedQuery(query.trim())}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <CircleCloseIcon size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {query.trim().length === 0 ? (
          <>
            <Text style={styles.sectionTitle}>인기 검색어</Text>
            <View style={styles.keywordRows}>
              {POPULAR_KEYWORDS.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.keywordRow}>
                  {row.map((keyword) => (
                    <TouchableOpacity
                      key={keyword}
                      style={styles.keywordChip}
                      onPress={() => setSubmittedQuery(keyword)}
                    >
                      <Text style={styles.keywordChipText}>{keyword}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.suggestionList}>
            {suggestions.map((name, idx) => (
              <TouchableOpacity
                key={`${name}-${idx}`}
                style={styles.suggestionRow}
                onPress={() => setSubmittedQuery(name)}
              >
                <LocationPinIcon size={16} />
                <HighlightedText text={name} query={query.trim()} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// 검색어와 일치하는 앞부분만 진하게(black) 표시하고 나머지는 회색으로 — Figma 시안에서 "안동"
// 부분만 다른 색으로 강조된 걸 재현(2026-09-07 추가). 대소문자 구분 없이 접두어만 검사(자동완성
// 소스인 장소명이 대부분 검색어로 시작하므로 접두어 매칭으로 충분, decision-log 참고)
function HighlightedText({ text, query }: { text: string; query: string }) {
  const matched = text.toLowerCase().startsWith(query.toLowerCase());
  if (!matched) {
    return <Text style={styles.suggestionTextRest}>{text}</Text>;
  }
  return (
    <Text>
      <Text style={styles.suggestionTextMatch}>{text.slice(0, query.length)}</Text>
      <Text style={styles.suggestionTextRest}>{text.slice(query.length)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  backButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: colors.black },
  // Figma 실측(362:3204/3205): 320x44 흰 배경+테두리 pill(채움 없음, PlaceListScreen의 회색 채움
  // 검색창과는 다른 스타일) — 아이콘 16px 안쪽, 아이콘-텍스트 간격 6
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    letterSpacing: -0.35,
    color: colors.black,
    padding: 0,
  },
  content: { paddingBottom: 40 },
  // Figma 실측(362:3213/3253): 제목→칩 간격 12
  sectionTitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: -0.3,
    color: colors.gray500,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  // 행 간격 8, 칩 간격 4 — Figma 실측(362:3253 키워드 컨테이너) 그대로
  keywordRows: { paddingHorizontal: 20, gap: 8 },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  keywordChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keywordChipText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: -0.3, color: colors.black },
  // Figma 실측(362:4000 등 "Post Location Container"): 행 높이17, 행 간격 12(29-17), 아이콘-텍스트 간격4
  suggestionList: { paddingHorizontal: 20, gap: 12 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  suggestionTextMatch: { fontFamily: fonts.medium, fontSize: 12, color: colors.black },
  suggestionTextRest: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
});
