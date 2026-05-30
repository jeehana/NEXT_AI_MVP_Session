/**
 * 유사 chunk 검색 API — Session 2에서 채웁니다.
 *
 * 흐름:
 *   클라이언트 → POST /api/search { query, accessCode }
 *   → access code 검증
 *   → retrieveRelevantChunks(query) 호출
 *   → 결과를 그대로 JSON으로 반환 (UI 확인용)
 *
 * 이 endpoint는 디버깅/소스 확인용입니다.
 * 실제 챗봇 답변에는 app/api/chat/route.ts 안에서 RAG context를 직접 끼워 넣습니다.
 *
 * TODO SESSION 2-8:
 *   - 본체에서 retrieveRelevantChunks(query)를 호출하도록 바꾸세요.
 */

export const runtime = "nodejs";

type SearchBody = {
  query?: string;
  accessCode?: string;
};

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const expectedCode = process.env.APP_ACCESS_CODE;
  if (!expectedCode || body.accessCode !== expectedCode) {
    return Response.json(
      { error: "access code가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  if (!body.query || body.query.trim().length === 0) {
    return Response.json({ error: "query가 비어 있습니다." }, { status: 400 });
  }

  // TODO SESSION 2-8: (구현 완료) 유사 chunk 검색 결과를 그대로 반환 (UI 확인용).
  try {
    const { retrieveRelevantChunks } = await import("@/lib/ai/rag");
    const chunks = await retrieveRelevantChunks(body.query);
    return Response.json({ chunks });
  } catch (err) {
    console.error("[/api/search] 검색 실패:", err);
    return Response.json(
      { error: "검색 중 오류가 발생했습니다. (서버 로그 확인)" },
      { status: 500 },
    );
  }
}
