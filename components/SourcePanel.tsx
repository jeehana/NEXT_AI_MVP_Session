"use client";

import type { RetrievedChunk } from "@/lib/ai/rag";

/**
 * RAG 검색 결과(출처) 표시 UI — Session 2에서 채웁니다.
 *
 * 챗봇이 어떤 chunk를 참고해 답했는지 학회원이 눈으로 확인할 수 있어야
 * RAG가 제대로 동작하는지 디버깅하기 쉽습니다.
 *
 * TODO SESSION 2-8: (구현 완료) 받은 chunks를 카드로 렌더.
 *   /api/search 호출은 Chat.tsx가 답변 완료 후 수행해서 chunks를 내려준다.
 */
export function SourcePanel({ chunks }: { chunks: RetrievedChunk[] }) {
  if (!chunks || chunks.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-medium">SourcePanel — Session 2에서 구현 예정</p>
        <p className="mt-1 text-xs">
          최근 답변에 사용된 chunk들을 여기 표시합니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      {chunks.map((chunk, i) => (
        <article
          key={i}
          className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-1 text-xs text-zinc-500">
            #{i + 1} · similarity {chunk.similarity.toFixed(3)}
          </div>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
            {chunk.content}
          </p>
        </article>
      ))}
    </section>
  );
}
