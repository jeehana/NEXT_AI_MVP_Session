/**
 * OpenAI embedding 생성 — Session 2에서 채웁니다.
 *
 * embedding = 텍스트를 고정 길이 숫자 벡터로 변환한 것.
 * 의미가 비슷한 문장은 벡터 공간에서도 가까이 위치한다 → 검색에 사용.
 *
 * 모델 후보:
 *   - "text-embedding-3-small"  (저렴, 1536 dim) ← 기본 추천
 *   - "text-embedding-3-large"  (성능 좋음, 3072 dim, 비쌈)
 *
 * ⚠️ dimension은 supabase/schema.sql의 `vector(N)`과 반드시 일치시켜야 합니다.
 *
 * ⚠️ 모델을 바꾸면 supabase/schema.sql의 vector(N) 차원도 같이 바꿔야 합니다.
 *
 * TODO SESSION 2-2: (구현 완료) embed/embedMany로 OpenAI embedding 생성.
 */
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// schema.sql의 vector(1536)과 일치해야 한다.
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

/**
 * 여러 텍스트를 한 번에 embedding (batch 호출, 비용/속도 면에서 유리).
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
