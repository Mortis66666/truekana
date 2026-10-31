import { invalid, requireUser, serverError } from "@/lib/supabase/server";

const defaultSettings = {
  reviewMode: "srs",
  wrongRetryMinutes: 10,
  shuffle: true,
  showReadingFirst: false,
  autoSubmission: true,
  showDefinitionAfterCorrect: false,
  correctBehavior: "never",
  wrongBehavior: "next_session",
  correctDelayMinutes: 10,
  wrongDelayMinutes: 10,
  collectRandomly: true,
};

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  const { data, error } = await supabase
    .from("study_sets")
    .select("id,name,settings,created_at,study_set_decks(deck_id,decks(id,name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return serverError(error.message);
  return Response.json({ studySets: data });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  let body: { name?: unknown; deckIds?: unknown; settings?: unknown };
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const deckIds = Array.isArray(body.deckIds)
    ? [...new Set(body.deckIds.filter((id): id is string => typeof id === "string"))]
    : [];
  if (!name || deckIds.length === 0) return invalid("name and at least one deckId are required");
  const settings = { ...defaultSettings, ...(body.settings && typeof body.settings === "object" ? body.settings : {}) };
  const { data: decks, error: deckError } = await supabase.from("decks").select("id").in("id", deckIds);
  if (deckError) return serverError(deckError.message);
  if (!decks || decks.length !== deckIds.length) return invalid("One or more deckIds are invalid");
  const { data: studySet, error } = await supabase
    .from("study_sets")
    .insert({ name, user_id: user.id, settings })
    .select("id,name,settings,created_at")
    .single();
  if (error || !studySet) return serverError(error?.message ?? "Could not create study set");
  const { error: relationError } = await supabase
    .from("study_set_decks")
    .insert(deckIds.map(deck_id => ({ study_set_id: studySet.id, deck_id })));
  if (relationError) {
    await supabase.from("study_sets").delete().eq("id", studySet.id);
    return serverError(relationError.message);
  }
  return Response.json({ studySet: { ...studySet, deckIds } }, { status: 201 });
}
