import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { chatModel } from "@/lib/ai/model";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { retrieveRelevantChunks, buildRagContext } from "@/lib/ai/rag";
import {
  MAX_INPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_HISTORY_MESSAGES,
  TEMPERATURE,
} from "@/lib/utils/limits";

/**
 * 챗봇 API route.
 *
 * 흐름:
 *   1) 클라이언트가 POST로 messages와 accessCode를 보낸다.
 *   2) accessCode를 검증한다. (서버에서만 환경변수와 비교)
 *   3) OPENAI_API_KEY가 있는지 확인한다.
 *   4) 마지막 사용자 메시지 길이를 검사한다.
 *   5) Vercel AI SDK의 streamText로 모델 호출 후 stream 응답을 돌려준다.
 *
 * 왜 서버 route를 쓰는가?
 *   - OPENAI_API_KEY는 절대 클라이언트로 나가면 안 된다.
 *   - 누군가 본인의 사이트에서 직접 OpenAI에 요청하면, 키가 노출되고
 *     얼마든지 도용해 비용을 태울 수 있다.
 *   - 그래서 키를 쓰는 호출은 항상 server route 안에서만 이뤄져야 한다.
 */

export const runtime = "nodejs";

type ChatRequestBody = {
  messages: UIMessage[];
  accessCode?: string;
};

export async function POST(req: Request) {
  // ---------- 1. body 파싱 ----------
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { messages, accessCode } = body;

  // ---------- 2. access code 검증 ----------
  const expectedCode = process.env.APP_ACCESS_CODE;
  if (!expectedCode) {
    return Response.json(
      {
        error:
          "서버에 APP_ACCESS_CODE가 설정되어 있지 않습니다. .env.local 또는 Vercel 환경변수를 확인하세요.",
      },
      { status: 500 },
    );
  }
  if (!accessCode || accessCode !== expectedCode) {
    return Response.json(
      { error: "access code가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  // ---------- 3. OpenAI 키 검증 ----------
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY가 설정되어 있지 않습니다. .env.local 또는 Vercel 환경변수에 키를 추가하세요.",
      },
      { status: 500 },
    );
  }

  // ---------- 4. messages 유효성 ----------
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "메시지가 비어 있습니다." },
      { status: 400 },
    );
  }

  // 마지막 사용자 메시지 길이 제한
  const lastMessage = messages[messages.length - 1];
  const lastText = extractText(lastMessage);
  if (lastText.length > MAX_INPUT_CHARS) {
    return Response.json(
      {
        error: `메시지가 너무 깁니다. ${MAX_INPUT_CHARS}자 이하로 줄여주세요.`,
      },
      { status: 400 },
    );
  }

  // 히스토리도 잘라서 비용을 보호한다 (오래된 대화는 버린다).
  const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);

  // ---------- 5. (Session 2/3) 질문 유형에 따라 추가 context 만들기 ----------
  //
  // TODO SESSION 3-4: classifyQuestion(lastText)으로 "rag" | "web" | "direct" 분기.
  //   import { classifyQuestion } from "@/lib/ai/router";
  //
  // TODO SESSION 3-4 (web 분기): searchWeb → buildWebContext로
  //   system prompt에 검색 결과를 추가하고 출처 URL을 인용하라고 안내하세요.
  //   import { searchWeb, buildWebContext } from "@/lib/tavily/search";
  let systemPrompt = buildSystemPrompt();

  // TODO SESSION 2-6: 질문과 유사한 자기소개 chunk를 검색해 system prompt에 덧붙인다.
  //   검색/임베딩이 실패해도 챗봇 자체는 동작해야 하므로 try/catch로 감싼다.
  try {
    const chunks = await retrieveRelevantChunks(lastText);
    const ragContext = buildRagContext(chunks);
    if (ragContext) {
      systemPrompt = `${systemPrompt}\n\n${ragContext}`;
    }
  } catch (err) {
    console.error("[/api/chat] RAG 검색 실패 (RAG 없이 진행):", err);
  }

  // ---------- 6. 모델 호출 ----------
  try {
    const modelMessages = await convertToModelMessages(trimmedMessages);
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });

    // streamText의 결과를 UI message stream으로 변환해 클라이언트에 전달한다.
    // useChat 훅이 이 형식을 그대로 이해한다.
    return result.toUIMessageStreamResponse();
  } catch (err) {
    // 모델 호출 실패 시 (예: 잘못된 키, 모델 권한 없음, 네트워크 문제)
    // 앱이 죽지 않도록 에러를 JSON으로 돌려준다.
    console.error("[/api/chat] streamText 실패:", err);
    return Response.json(
      {
        error:
          "모델 호출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (서버 로그를 확인하세요)",
      },
      { status: 500 },
    );
  }
}

/**
 * UIMessage에서 텍스트만 뽑아낸다.
 *
 * UIMessage는 여러 part로 구성될 수 있다 (text, tool call, file 등).
 * 세션 1에서는 text part만 다루므로 그것만 합쳐서 길이를 잰다.
 */
function extractText(message: UIMessage): string {
  if (!message?.parts) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
