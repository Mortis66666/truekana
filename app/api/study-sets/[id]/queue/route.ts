import { requireUser, serverError } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
type EmbeddedCard = {
  id: string;
  deck_id: string;
  kanji: string;
  meaning: string;
  reading: string[];
  decks?: unknown;
};
// PostgREST returns a many-to-one embed (progress.card_id -> cards.id) as a single
// object, not an array. Handle both shapes so a schema change cannot blank the card.
type DueRow = { card_id: string; status: number; cards: EmbeddedCard | EmbeddedCard[] | null };

function embeddedCard(row: DueRow): Partial<EmbeddedCard> {
  const { cards } = row;
  if (Array.isArray(cards)) return cards[0] ?? {};
  return cards ?? {};
}

function sampleRandomly<T>(items: T[], count: number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;
  const { data: studySet, error: setError } = await supabase.from("study_sets").select("name,settings").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (setError) return serverError(setError.message);
  if (!studySet) return Response.json({ error: "Study set not found" }, { status: 404 });
  const settings = (studySet.settings ?? {}) as { shuffle?: boolean; collectRandomly?: boolean };
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 0);
  const isNewSession = new URL(request.url).searchParams.get("start") === "1";
  if (isNewSession) {
    const { error: sessionError } = await supabase
      .from("progress")
      .update({
        deferred_next_session: false,
        due: new Date().toISOString()
      })
      .eq("study_set_id", id)
      .eq("user_id", user.id)
      .eq("deferred_next_session", true);
    if (sessionError) return serverError(sessionError.message);
  }
  const excludedIds = (new URL(request.url).searchParams.get("exclude") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const batchLimit = requestedLimit > 0 ? Math.min(500, requestedLimit) : null;
  const reviewLimit = batchLimit ?? 500;
  const newLimit = batchLimit ?? 500;
  const { data: memberships, error: membershipError } = await supabase.from("study_set_decks").select("deck_id").eq("study_set_id", id);
  if (membershipError) return serverError(membershipError.message);
  const deckIds = (memberships ?? []).map(item => item.deck_id);
  const { data: deckRows, error: deckError } = deckIds.length
    ? await supabase.from("decks").select("id,name").in("id", deckIds)
    : { data: [], error: null };
  if (deckError) return serverError(deckError.message);
  const deckNames = deckIds
    .map(deckId => deckRows?.find(deck => deck.id === deckId)?.name)
    .filter((name): name is string => Boolean(name));
  let due: DueRow[] = [];
  let dueError: { message: string } | null = null;
  if (settings.collectRandomly === false) {
    if (deckIds.length) {
      let dueQuery = supabase.from("progress").select("card_id,due,status,cards!inner(id,deck_id,kanji,meaning,reading,decks(id,name))").eq("study_set_id", id).eq("deferred_next_session", false).lte("due", new Date().toISOString()).in("cards.deck_id", deckIds).order("due").limit(reviewLimit);
      if (excludedIds.length) dueQuery = dueQuery.not("card_id", "in", `(${excludedIds.join(",")})`);
      const result = await dueQuery;
      due = result.data ?? [];
      dueError = result.error;
    }
  } else {
    const dueResults = await Promise.all(deckIds.map(deckId => {
      let dueQuery = supabase.from("progress").select("card_id,due,status,cards!inner(id,deck_id,kanji,meaning,reading,decks(id,name))").eq("study_set_id", id).eq("deferred_next_session", false).lte("due", new Date().toISOString()).eq("cards.deck_id", deckId).limit(200);
      if (excludedIds.length) dueQuery = dueQuery.not("card_id", "in", `(${excludedIds.join(",")})`);
      return dueQuery;
    }));
    due = dueResults.flatMap(result => result.data ?? []) as DueRow[];
    dueError = dueResults.find(result => result.error)?.error ?? null;
  }
  if (dueError) return serverError(dueError.message);
  const selectedDue = settings.collectRandomly === false
    ? due ?? []
    : sampleRandomly(due ?? [], reviewLimit);
  const seenIds = selectedDue.map(item => item.card_id);
  const remainingNewLimit = settings.collectRandomly === false
    ? (batchLimit === null ? newLimit : Math.max(0, batchLimit - selectedDue.length))
    : newLimit;
  const excludedNewIds = [...new Set([...seenIds, ...excludedIds])];
  const { data: reviewedCards, error: reviewedError } = await supabase
    .from("progress")
    .select("card_id")
    .eq("study_set_id", id);
  if (reviewedError) return serverError(reviewedError.message);
  const allSeenIds = [...new Set([...excludedNewIds, ...(reviewedCards ?? []).map(item => item.card_id)])];
  const newResults = await Promise.all(deckIds.map(deckId => {
    let newCardsQuery = supabase.from("cards").select("id,deck_id,kanji,meaning,reading,decks(id,name)").eq("deck_id", deckId);
    if (allSeenIds.length) newCardsQuery = newCardsQuery.not("id", "in", `(${allSeenIds.join(",")})`);
    return newCardsQuery.limit(settings.collectRandomly === false ? remainingNewLimit : 200);
  }));
  const availableNewCards = newResults.flatMap(result => result.data ?? []);
  const newError = newResults.find(result => result.error)?.error ?? null;
  if (newError) return serverError(newError.message);
  const newCards = settings.collectRandomly !== false
    ? sampleRandomly(availableNewCards ?? [], remainingNewLimit)
    : availableNewCards ?? [];
  const dueCards = selectedDue.map(item => ({
    ...embeddedCard(item),
    seen: true,
    progressStatus: item.status,
  }));
  const newCardPayload = newCards.map(card => ({ ...card, seen: false }));
  const cards = settings.collectRandomly !== false
    ? sampleRandomly([...dueCards, ...newCardPayload], batchLimit ?? 10)
    : [...dueCards, ...newCardPayload];
  const [totalResult, seenResult, correctResult] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).in("deck_id", deckIds),
    supabase.from("progress").select("card_id", { count: "exact", head: true }).eq("study_set_id", id),
    supabase.from("progress").select("card_id", { count: "exact", head: true }).eq("study_set_id", id).eq("status", 1),
  ]);
  const statsError = totalResult.error ?? seenResult.error ?? correctResult.error;
  if (statsError) return serverError(statsError.message);
  return Response.json({
    cards,
    settings,
    studySet: { name: studySet.name, deckNames },
    stats: {
      totalCards: totalResult.count ?? 0,
      seenCards: seenResult.count ?? 0,
      correctCards: correctResult.count ?? 0,
    },
  });
}
