import { supabase } from "./supabaseClient";

// Supabase/PostgREST caps each request at a max row count (1000 by default),
// even if you don't set a .limit() yourself. For tables that can grow past
// that (like products), page through with .range() until we've got it all.
const PAGE_SIZE = 1000;

export async function fetchAllRows(
  table,
  { select = "*", orderBy, ascending = true, filters = {}, eq = {} } = {}
) {
  let all = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (orderBy) query = query.order(orderBy, { ascending });
    Object.entries(eq).forEach(([col, val]) => {
      query = query.eq(col, val);
    });
    if (filters.gte) query = query.gte(filters.gte[0], filters.gte[1]);
    if (filters.lte) query = query.lte(filters.lte[0], filters.lte[1]);
    const { data, error } = await query;
    if (error) return { data: null, error };

    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: all, error: null };
}
