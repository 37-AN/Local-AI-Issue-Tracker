import { createClient } from "@/lib/supabase/server";

export type SopInput = {
    title: string;
    problem_description: string;
    symptoms: string[];
    root_cause: string;
    resolution_steps: string[];
    validation_steps: string[];
    rollback_procedures: string[];
    references: string[];
    tags?: string[];
    status?: "Draft" | "Approved";
};

export async function createSop(input: SopInput) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await (supabase.from("sops") as any)
        .insert({
            title: input.title,
            problem_description: input.problem_description,
            symptoms: input.symptoms,
            root_cause: input.root_cause,
            resolution_steps: input.resolution_steps,
            validation_steps: input.validation_steps,
            rollback_procedures: input.rollback_procedures,
            references: input.references,
            tags: input.tags ?? [],
            status: input.status ?? "Draft",
            created_by: user?.id,
        })
        .select("*")
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function listSops(params: { tags?: string[]; query?: string }) {
    const supabase = await createClient();
    let query = (supabase.from("sops") as any).select("*").order("updated_at", { ascending: false });

    if (params.query) {
        query = query.or(`title.ilike.%${params.query}%,problem_description.ilike.%${params.query}%`);
    }

    if (params.tags && params.tags.length > 0) {
        query = query.contains("tags", params.tags);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function getSopById(id: string) {
    const supabase = await createClient();
    const { data, error } = await (supabase.from("sops") as any)
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateSop(id: string, updates: Partial<SopInput>) {
    const supabase = await createClient();
    const { data, error } = await (supabase.from("sops") as any)
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

    if (error) throw new Error(error.message);
    return data;
}
