import { requireUser, serverError } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase, user, response } = await requireUser(request);
  if (response || !user) return response;

  const { error } = await supabase
    .from("progress")
    .delete()
    .eq("study_set_id", id)
    .eq("user_id", user.id);
  if (error) return serverError(error.message);
  return Response.json({ success: true });
}
