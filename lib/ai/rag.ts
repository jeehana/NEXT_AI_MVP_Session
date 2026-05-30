/**
 * RAG (Retrieval-Augmented Generation) — Session 2에서 채웁니다.
 *
 * 전체 흐름:
 *   [ingest 시점]
 *     문서 → chunkText() → createEmbedding() → Supabase documents 테이블에 저장
 *
 *   [질문 시점]
 *     사용자 질문 → createEmbedding() → match_documents RPC로 유사 chunk 검색
 *                → buildRagContext()로 system prompt에 끼워 넣기 → LLM 호출
 *
 * 핵심 원칙:
 *   - 검색된 chunk가 없으면 "모른다"고 답하도록 system prompt에 명시.
 *   - topK는 3~5개로 제한 (너무 많으면 토큰 낭비 + 잡음 증가).
 */

import { chunkText } from "@/lib/utils/chunk";
import { createEmbedding, createEmbeddings } from "@/lib/ai/embeddings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type RetrievedChunk = {
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
};

// Supabase documents 테이블의 한 row 모양.
type DocumentRow = {
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
};

// match_documents RPC가 돌려주는 한 row 모양.
type MatchRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

/**
 * 자기소개 문서 한 편을 받아 chunking → embedding → Supabase 저장까지.
 *
 * TODO SESSION 2-3: (구현 완료) chunk → embed → documents 테이블 insert.
 */
export async function ingestDocument(text: string): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  // chunk 전부를 한 번에 embedding (batch가 개별 호출보다 싸고 빠르다).
  const embeddings = await createEmbeddings(chunks);

  const rows: DocumentRow[] = chunks.map((content, i) => ({
    content,
    metadata: { chunk_index: i },
    embedding: embeddings[i],
  }));

  // service role 키는 RLS를 우회하므로 반드시 서버에서만 호출돼야 한다.
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("documents").insert(rows);
  if (error) {
    throw new Error(`문서 저장 실패: ${error.message}`);
  }
}

/**
 * 사용자 질문에 가장 유사한 chunk를 Supabase에서 검색.
 *
 * TODO SESSION 2-5: (구현 완료) 질문 embed → match_documents RPC 호출.
 */
export async function retrieveRelevantChunks(
  query: string,
  topK: number = 4,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await createEmbedding(query);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });
  if (error) {
    throw new Error(`유사 chunk 검색 실패: ${error.message}`);
  }

  return ((data ?? []) as MatchRow[]).map((row) => ({
    content: row.content,
    similarity: row.similarity,
    metadata: row.metadata,
  }));
}

/**
 * 검색된 chunk들을 LLM에 줄 context 문자열로 변환.
 * 빈 배열이면 빈 문자열을 반환해 호출부에서 "RAG 미적용"으로 분기할 수 있게 한다.
 *
 * TODO SESSION 2-6: (구현 완료) 안내문 + 번호 매긴 chunk로 context 조립.
 */
export function buildRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const facts = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  return [
    "# 사용자에 대한 사실 (자기소개 문서에서 검색됨)",
    "아래 정보에 근거해서만 개인적인 사실을 답하라.",
    "여기에 없는 개인 정보는 모른다고 답하고, 지어내지 마라.",
    "",
    facts,
  ].join("\n");
}
