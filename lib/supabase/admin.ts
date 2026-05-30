/**
 * Supabase 관리자(service role) 클라이언트 — Session 2에서 채웁니다.
 *
 * ⚠️ SUPABASE_SERVICE_ROLE_KEY는 RLS를 우회하는 강력한 키입니다.
 *    절대로 클라이언트 코드(컴포넌트 등)에 import 하지 마세요.
 *    이 파일은 server route(예: app/api/ingest/route.ts)에서만 import.
 *
 *
 * TODO SESSION 2-3: (구현 완료) service role 키로 관리자 클라이언트 생성. 서버 전용!
 */
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
