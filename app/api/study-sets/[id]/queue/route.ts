import { requireUser, serverError } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  const { data: studySet, error: setError } = await supabase.from("study_sets").select("settings").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (setError) return serverError(setError.message);
  if (!studySet) return Response.json({ error: "Study set not found" }, { status: 404 });
  const settings = (studySet.settings ?? {}) as { shuffle?: boolean };
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 0);
  const isNewSession = new URL(request.url).searchParams.get("start") === "1";
  if (isNewSession) {
    const { error: sessionError } = await supabase.from("progress").update({ deferred_next_session: false }).eq("study_set_id", id).eq("user_id", user.id).eq("deferred_next_session", true);
    if (sessionError) return serverError(sessionError.message);
  }
  const excludedIds = (new URL(request.url).searchParams.get("exclude") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const batchLimit = requestedLimit > 0 ? Math.min(500, requestedLimit) : null;
  const reviewLimit = batchLimit ?? 500;
  const newLimit = batchLimit ?? 500;
  let dueQuery = supabase.from("progress").select("card_id,due,status,cards(id,deck_id,kanji,meaning,reading,decks(id,name))").eq("study_set_id", id).eq("deferred_next_session", false).lte("due", new Date().toISOString()).order("due").limit(reviewLimit);
  if (excludedIds.length) dueQuery = dueQuery.not("card_id", "in", `(${excludedIds.join(",")})`);
  const { data: due, error: dueError } = await dueQuery;
  if (dueError) return serverError(dueError.message);
  const seenIds = (due ?? []).map(item => item.card_id);
  const remainingNewLimit = batchLimit === null ? newLimit : Math.max(0, batchLimit - (due?.length ?? 0));
  let newCardsQuery = supabase.from("cards").select("id,deck_id,kanji,meaning,reading,decks(id,name)").limit(remainingNewLimit);
  const { data: memberships, error: membershipError } = await supabase.from("study_set_decks").select("deck_id").eq("study_set_id", id);
  if (membershipError) return serverError(membershipError.message);
  const deckIds = (memberships ?? []).map(item => item.deck_id);
  const excludedNewIds = [...new Set([...seenIds, ...excludedIds])];
  const { data: reviewedCards, error: reviewedError } = await supabase
    .from("progress")
    .select("card_id")
    .eq("study_set_id", id);
  if (reviewedError) return serverError(reviewedError.message);
  const allSeenIds = [...new Set([...excludedNewIds, ...(reviewedCards ?? []).map(item => item.card_id)])];
  if (deckIds.length) newCardsQuery = newCardsQuery.in("deck_id", deckIds).not("id", "in", `(${allSeenIds.join(",") || "null"})`);
  const { data: newCards, error: newError } = deckIds.length ? await newCardsQuery : { data: [], error: null };
  if (newError) return serverError(newError.message);
  const [totalResult, seenResult, correctResult] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).in("deck_id", deckIds),
    supabase.from("progress").select("card_id", { count: "exact", head: true }).eq("study_set_id", id),
    supabase.from("progress").select("card_id", { count: "exact", head: true }).eq("study_set_id", id).eq("status", 1),
  ]);
  const statsError = totalResult.error ?? seenResult.error ?? correctResult.error;
  if (statsError) return serverError(statsError.message);
  return Response.json({
    cards: [
      ...(due ?? []).map(item => ({ ...item.cards, seen: true, progressStatus: item.status })),
      ...(newCards ?? []).map(card => ({ ...card, seen: false })),
    ],
    settings,
    stats: {
      totalCards: totalResult.count ?? 0,
      seenCards: seenResult.count ?? 0,
      correctCards: correctResult.count ?? 0,
    },
  });
}
