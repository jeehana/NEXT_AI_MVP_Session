/**
 * 텍스트 chunking 유틸 — Session 2에서 채웁니다.
 *
 * RAG의 가장 첫 단계: 긴 문서를 작은 조각(chunk)으로 나눠야
 * 1) embedding 모델의 입력 길이를 넘지 않고,
 * 2) 검색 시 "정확히 필요한 부분만" 골라낼 수 있다.
 *
 * 너무 크게 자르면 → 한 chunk에 여러 주제가 섞여 검색 정확도 하락.
 * 너무 작게 자르면 → 문맥이 끊겨 모델이 의미 파악을 못 함.
 * 보통 500~1000 글자 / 100~200 글자 overlap 정도가 무난.
 *
 * TODO SESSION 2-1:
 *   - 입력 텍스트를 일정 크기(예: 500자) chunk로 나누세요.
 *   - 인접 chunk 간 overlap(예: 100자)을 줘서 문맥이 끊기지 않게 하세요.
 *   - 공백/줄바꿈 기준으로 자르는 게 단순합니다. (paragraph 단위도 OK)
 *
 *
 * TODO SESSION 2-1: (구현 완료) 500자 chunk + 100자 overlap으로 분할.
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100,
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  // step만큼 시작점을 옮기되, overlap만큼 겹쳐서 문맥이 끊기지 않게 한다.
  const step = chunkSize - overlap;
  for (let start = 0; start < clean.length; start += step) {
    chunks.push(clean.slice(start, start + chunkSize));
    if (start + chunkSize >= clean.length) break;
  }
  return chunks;
}
