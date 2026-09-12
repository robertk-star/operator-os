"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anon } = getSupabasePublicEnv();
  return createBrowserClient(url, anon);
}
