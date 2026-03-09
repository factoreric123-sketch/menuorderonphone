import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per Deno isolate)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 orders per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  // Cleanup old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (val.every(t => now - t > RATE_LIMIT_WINDOW)) rateLimitMap.delete(key);
    }
  }
  return false;
}

// Input validation helpers
function sanitizeString(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function isValidUUID(val: unknown): boolean {
  return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { restaurant_id, table_qr_code_id, guest_name, guest_phone, payment_method, notes, items } = body;

    // ===== INPUT VALIDATION =====
    if (!isValidUUID(restaurant_id)) {
      return new Response(JSON.stringify({ error: "Invalid restaurant ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanName = sanitizeString(guest_name, 100);
    if (!cleanName) {
      return new Response(JSON.stringify({ error: "Guest name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return new Response(JSON.stringify({ error: "Order must have 1-100 items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = sanitizeString(guest_phone, 20);
    const cleanNotes = sanitizeString(notes, 500);
    const cleanPayment = payment_method === "stripe" ? "stripe" : "pay_at_table";

    // Validate each item has required fields
    for (const item of items) {
      if (!isValidUUID(item.dish_id)) {
        return new Response(JSON.stringify({ error: "Invalid dish ID in order" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty < 1 || qty > 99) {
        return new Response(JSON.stringify({ error: "Invalid quantity (1-99)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch restaurant to check ordering_enabled and tax_rate
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("id, ordering_enabled, tax_rate")
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!restaurant.ordering_enabled) {
      return new Response(JSON.stringify({ error: "Online ordering is currently disabled for this restaurant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve table_id from qr_code_id
    let tableId: string | null = null;
    if (table_qr_code_id && typeof table_qr_code_id === "string") {
      const cleanQr = table_qr_code_id.slice(0, 20);
      const { data: table } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("qr_code_id", cleanQr)
        .eq("restaurant_id", restaurant_id)
        .eq("active", true)
        .maybeSingle();
      tableId = table?.id || null;
    }

    // Validate dish prices from DB
    const dishIds = items.map((i: any) => i.dish_id);
    const { data: dishes, error: dishError } = await supabase
      .from("dishes")
      .select("id, name, price, has_options, available, restaurant_id")
      .in("id", dishIds);

    if (dishError || !dishes) {
      return new Response(JSON.stringify({ error: "Failed to validate dishes" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify all dishes belong to this restaurant
    const foreignDishes = dishes.filter((d: any) => d.restaurant_id !== restaurant_id);
    if (foreignDishes.length > 0) {
      return new Response(JSON.stringify({ error: "Some dishes do not belong to this restaurant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for unavailable items
    const unavailable = dishes.filter((d: any) => d.available === false);
    if (unavailable.length > 0) {
      return new Response(JSON.stringify({
        error: `These items are currently unavailable: ${unavailable.map((d: any) => d.name).join(", ")}`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dishMap = new Map(dishes.map((d: any) => [d.id, d]));

    // Fetch all options for dishes that have them
    const dishesWithOptions = dishes.filter((d: any) => d.has_options).map((d: any) => d.id);
    const optionsMap = new Map();
    if (dishesWithOptions.length > 0) {
      const { data: options } = await supabase
        .from("dish_options")
        .select("id, dish_id, name, price")
        .in("dish_id", dishesWithOptions);
      options?.forEach((o: any) => {
        optionsMap.set(`${o.dish_id}:${o.name}`, o);
      });
    }

    // Fetch all modifiers for price validation
    const { data: allModifiers } = await supabase
      .from("dish_modifiers")
      .select("id, dish_id, name, price")
      .in("dish_id", dishIds);
    const modifierMap = new Map();
    allModifiers?.forEach((m: any) => {
      modifierMap.set(`${m.dish_id}:${m.name}`, m);
    });

    // Build validated order items and compute subtotal
    let subtotalCents = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const dish = dishMap.get(item.dish_id);
      if (!dish) continue;

      let unitPriceCents: number;
      let optionName: string | null = null;

      if (item.selected_option_name && dish.has_options) {
        const opt = optionsMap.get(`${item.dish_id}:${item.selected_option_name}`);
        if (opt) {
          unitPriceCents = Math.round(parseFloat(opt.price.replace(/[^0-9.]/g, "")) * 100);
          optionName = opt.name;
        } else {
          unitPriceCents = Math.round(parseFloat(dish.price.replace(/[^0-9.]/g, "")) * 100);
        }
      } else {
        unitPriceCents = Math.round(parseFloat(dish.price.replace(/[^0-9.]/g, "")) * 100);
      }

      // Validate and price modifiers server-side
      const modifierNames: string[] = [];
      let modifierTotalCents = 0;
      if (Array.isArray(item.selected_modifier_names)) {
        for (const modName of item.selected_modifier_names.slice(0, 20)) {
          const cleanMod = sanitizeString(modName, 100);
          if (!cleanMod) continue;
          const mod = modifierMap.get(`${item.dish_id}:${cleanMod}`);
          if (mod) {
            modifierNames.push(mod.name);
            modifierTotalCents += Math.round(parseFloat(mod.price.replace(/[^0-9.]/g, "")) * 100);
          }
        }
      }

      const quantity = Math.max(1, Math.min(99, parseInt(item.quantity) || 1));
      const itemSubtotalCents = (unitPriceCents + modifierTotalCents) * quantity;
      subtotalCents += itemSubtotalCents;

      validatedItems.push({
        dish_id: item.dish_id,
        dish_name: dish.name, // Always use server name, not client
        quantity,
        unit_price_cents: unitPriceCents,
        selected_option_name: optionName,
        selected_modifier_names: modifierNames.length > 0 ? modifierNames : null,
        subtotal_cents: itemSubtotalCents,
        special_instructions: sanitizeString(item.special_instructions, 300) || null,
        station: "kitchen",
      });
    }

    if (validatedItems.length === 0) {
      return new Response(JSON.stringify({ error: "No valid items in order" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate tax
    const taxRate = parseFloat(restaurant.tax_rate) || 0;
    const taxCents = Math.round(subtotalCents * taxRate);
    const totalCents = subtotalCents + taxCents;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id,
        table_id: tableId,
        guest_name: cleanName,
        guest_phone: cleanPhone || null,
        payment_method: cleanPayment,
        total_cents: totalCents,
        tax_cents: taxCents,
        notes: cleanNotes || null,
        status: "pending",
        payment_status: "unpaid",
      })
      .select("id, session_token")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert order items
    const orderItems = validatedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
    }

    // Fire-and-forget email notification to owner
    try {
      const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-order`;
      fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id, restaurant_id }),
      }).catch(err => console.warn("Notify email failed:", err));
    } catch {}

    return new Response(
      JSON.stringify({
        order_id: order.id,
        session_token: order.session_token,
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        total_cents: totalCents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create order error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
