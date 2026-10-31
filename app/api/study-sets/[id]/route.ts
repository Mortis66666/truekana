import { invalid, requireUser, serverError } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  const { data, error } = await supabase
    .from("study_sets")
    .select("id,name,settings,created_at,study_set_decks(deck_id,decks(id,name))")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return serverError(error.message);
  if (!data) return Response.json({ error: "Study set not found" }, { status: 404 });
  return Response.json({ studySet: data });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  let body: { name?: unknown; settings?: unknown; decks?: unknown };
  try { body = await request.json(); } catch { return invalid("Request body must be valid JSON"); }
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return invalid("name must be a non-empty string");
    updates.name = body.name.trim();
  }
  if (body.settings !== undefined) {
    if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) return invalid("settings must be an object");
    updates.settings = body.settings;
  }
  if (Object.keys(updates).length) {
    const { error } = await supabase.from("study_sets").update(updates).eq("id", id).eq("user_id", user.id);
    if (error) return serverError(error.message);
  }
  if (body.decks !== undefined) {
    if (!Array.isArray(body.decks) || body.decks.length === 0 || body.decks.some(deck => typeof deck !== "string")) return invalid("decks must be a non-empty array of ids");
    const deckIds = [...new Set(body.decks as string[])];
    const { data: decks, error: deckError } = await supabase.from("decks").select("id").in("id", deckIds);
    if (deckError) return serverError(deckError.message);
    if (!decks || decks.length !== deckIds.length) return invalid("One or more deckIds are invalid");
    const { error: deleteError } = await supabase.from("study_set_decks").delete().eq("study_set_id", id);
    if (deleteError) return serverError(deleteError.message);
    const { error: insertError } = await supabase.from("study_set_decks").insert(deckIds.map(deck_id => ({ study_set_id: id, deck_id })));
    if (insertError) return serverError(insertError.message);
  }
  return GET(request, { params: Promise.resolve({ id }) });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  const { error } = await supabase.from("study_sets").delete().eq("id", id).eq("user_id", user.id);
  if (error) return serverError(error.message);
  return new Response(null, { status: 204 });
}
