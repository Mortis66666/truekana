import { createClient } from "@supabase/supabase-js";

export function getServerSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const authorization = request.headers.get("authorization");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

export async function requireUser(request: Request) {
  const supabase = getServerSupabase(request);
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null }, error: new Error("Missing bearer token") };
  if (error || !data.user) {
    return { supabase, user: null, response: Response.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { supabase, user: data.user, response: null };
}

export function invalid(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function serverError(message: string) {
  return Response.json({ error: message }, { status: 500 });
}
