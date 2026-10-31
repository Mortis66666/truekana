import { requireUser, serverError } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { supabase, response } = await requireUser(request);
  if (response) return response;
  const result = await supabase
    .from("decks")
    .select("id,category,name,description,sort_order")
    .order("sort_order");
  if (!result.error) return Response.json({ decks: result.data });

  // Keep existing installations usable until the category migration is applied.
  if (!result.error.message.toLowerCase().includes("category")) {
    return serverError(result.error.message);
  }
  const legacy = await supabase
    .from("decks")
    .select("id,name,description,sort_order")
    .order("sort_order");
  if (legacy.error) return serverError(legacy.error.message);
  return Response.json({
    decks: (legacy.data ?? []).map(deck => ({ ...deck, category: "JLPT" })),
  });
}
