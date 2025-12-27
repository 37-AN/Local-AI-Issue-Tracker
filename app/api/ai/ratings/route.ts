import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorContext } from "@/lib/rbac";

export async function POST(request: Request) {
    const supabase = await createClient();
    const actor = await getActorContext(supabase);

    try {
        const body = await request.json();
        const { ticketId, recommendationPayload, rating, feedback, modelInfo } = body;

        if (!ticketId || !rating) {
            return NextResponse.json({ error: "ticketId and rating are required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("ai_recommendation_ratings")
            .insert({
                ticket_id: ticketId,
                recommendation_payload: recommendationPayload,
                rating: rating,
                feedback: feedback,
                model_info: modelInfo,
                actor_id: actor.userId,
            })
            .select("*")
            .single();

        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true, rating: data });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to submit rating";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
