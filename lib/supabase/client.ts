/**
 * Supabase 브라우저(anon) 클라이언트 — Session 2에서 채웁니다.
 *
 * "anon" 클라이언트는 누구나 봐도 되는 공개 키(NEXT_PUBLIC_SUPABASE_ANON_KEY)를 사용합니다.
 * Row Level Security(RLS) 정책이 안전망 역할을 합니다.
 *
 *
 * TODO SESSION 2-3: (구현 완료) anon 키로 브라우저 클라이언트 생성.
 */
import { createClient } from "@supabase/supabase-js";

export function getSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
