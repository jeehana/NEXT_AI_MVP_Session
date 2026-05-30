"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { CharacterCard } from "@/components/CharacterCard";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { AccessCodeModal } from "@/components/AccessCodeModal";
import { IngestPanel } from "@/components/IngestPanel";
import { SourcePanel } from "@/components/SourcePanel";
import { characterConfig } from "@/lib/ai/prompts";
import type { RetrievedChunk } from "@/lib/ai/rag";

/**
 * 챗봇 메인 화면.
 *
 * 구조 (모바일은 세로 1단, 데스크탑은 좌측 카드 + 우측 채팅):
 *
 *   ┌─────────────┬───────────────────────────┐
 *   │ Character   │   메시지 목록             │
 *   │ Card        │                           │
 *   │             ├───────────────────────────┤
 *   │             │   입력창 + 전송 버튼      │
 *   └─────────────┴───────────────────────────┘
 *
 * access code 흐름:
 *   - 입장하면 채팅창이 바로 보인다.
 *   - 메시지를 보내려는 순간 accessCode가 없으면 모달이 뜬다.
 *   - 모달에서 코드를 입력하면 → 그 메시지를 자동으로 전송한다.
 *   - 이후 같은 세션에서는 모달 없이 전송된다.
 *   - "잠금" 버튼을 누르면 accessCode가 비워져 다음 메시지부터 다시 모달.
 *   - 새로고침하면 대화도 accessCode도 모두 사라진다. (의도된 단순함)
 */
export function Chat() {
  // access code는 클라이언트 메모리에만 보관한다.
  const [accessCode, setAccessCode] = useState<string | null>(null);

  // 모달이 떴을 때 임시로 들고 있는 "보내려던 메시지".
  // 코드 입력이 끝나면 이 메시지를 자동으로 sendMessage 한다.
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 마지막 답변에 사용된(참고된) RAG chunk들. SourcePanel 디버깅용.
  const [sources, setSources] = useState<RetrievedChunk[]>([]);
  // 직전에 보낸 질문 텍스트. 답변이 끝나면 이 질문으로 /api/search 를 호출한다.
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  // useChat은 마운트 시점의 transport를 잡아두기 때문에, accessCode가 바뀐다고
  // transport를 새로 만들어도 갈아끼지 않는다. 그래서 transport에는 api만 넣고,
  // accessCode는 매 sendMessage 호출 시 options.body로 전달한다.
  const transport = new DefaultChatTransport({ api: "/api/chat" });

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  // accessCode가 새로 채워졌고, 보내려던 메시지가 남아 있으면 자동으로 전송.
  // (transport가 새 accessCode로 다시 만들어진 다음 effect가 돌기 때문에 안전하다.)
  useEffect(() => {
    if (accessCode && pendingMessage) {
      sendMessage({ text: pendingMessage }, { body: { accessCode } });
      setLastQuery(pendingMessage);
      setPendingMessage(null);
    }
  }, [accessCode, pendingMessage, sendMessage]);

  // 답변 스트리밍이 끝나면(ready) 직전 질문으로 /api/search를 호출해
  // "이 답변에 어떤 chunk가 쓰였는지"를 SourcePanel에 보여준다.
  useEffect(() => {
    if (status !== "ready" || !lastQuery || !accessCode) return;
    const query = lastQuery;
    setLastQuery(null);
    (async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, accessCode }),
        });
        const data = await res.json();
        setSources(res.ok ? (data.chunks ?? []) : []);
      } catch {
        setSources([]);
      }
    })();
  }, [status, lastQuery, accessCode]);

  function handleSend(text: string) {
    if (!accessCode) {
      // 첫 메시지: 모달을 띄우고 메시지는 보류.
      setPendingMessage(text);
      setShowModal(true);
      return;
    }
    sendMessage({ text }, { body: { accessCode } });
    setLastQuery(text);
  }

  function handleClear() {
    // 화면의 메시지만 비운다. 서버에는 저장하지 않으므로 이걸로 충분.
    setMessages([]);
  }

  function handleLock() {
    // access code를 잊고 다음 메시지부터 다시 모달이 뜨게 한다.
    setAccessCode(null);
    setPendingMessage(null);
  }

  function handleUnlockSubmit(code: string) {
    setAccessCode(code);
    setShowModal(false);
    // pendingMessage 전송은 위 useEffect가 처리.
  }

  function handleCancelModal() {
    setShowModal(false);
    setPendingMessage(null);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-4 md:flex-row md:p-6">
      {/* 좌측: 캐릭터 카드 + 컨트롤 */}
      <div className="flex flex-col gap-3 md:w-72 md:shrink-0">
        <CharacterCard character={characterConfig} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            대화 초기화
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title="access code를 비워서 다음 전송 때 다시 입력하게 합니다"
          >
            잠금
          </button>
        </div>

        {/* RAG: 자기소개 학습 패널 + 마지막 답변에 쓰인 chunk 표시.
            accessCode가 있어야 /api/ingest·/api/search 가 통과하므로 그때만 노출. */}
        {accessCode ? (
          <>
            <IngestPanel accessCode={accessCode} />
            <SourcePanel chunks={sources} />
          </>
        ) : null}
      </div>

      {/* 우측: 메시지 영역 + 입력창 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <MessageList messages={messages} isStreaming={status === "streaming"} />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            오류: {error.message}
          </div>
        ) : null}

        <MessageInput onSend={handleSend} disabled={isBusy} />
      </div>

      {showModal ? (
        <AccessCodeModal
          onUnlock={handleUnlockSubmit}
          onCancel={handleCancelModal}
        />
      ) : null}
    </div>
  );
}
