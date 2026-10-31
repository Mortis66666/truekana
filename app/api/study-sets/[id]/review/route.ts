import { invalid, requireUser, serverError } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  let body: { cardId?: unknown; correct?: unknown };
  try { body = await request.json(); } catch { return invalid("Request body must be valid JSON"); }
  if (typeof body.cardId !== "string" || typeof body.correct !== "boolean") return invalid("cardId and correct are required");
  const { data, error } = await supabase.rpc("review_card", { p_study_set: id, p_card: body.cardId, p_correct: body.correct });
  if (error) return serverError(error.message);
  return Response.json({ progress: data });
}
