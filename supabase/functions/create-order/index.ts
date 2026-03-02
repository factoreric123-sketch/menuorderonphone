import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, table_qr_code_id, guest_name, guest_phone, payment_method, notes, items } = await req.json();

    if (!restaurant_id || !guest_name || !items?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve table_id from qr_code_id
    let tableId: string | null = null;
    if (table_qr_code_id) {
      const { data: table } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("qr_code_id", table_qr_code_id)
        .eq("restaurant_id", restaurant_id)
        .eq("active", true)
        .maybeSingle();
      tableId = table?.id || null;
    }

    // Validate dish prices from DB
    const dishIds = items.map((i: any) => i.dish_id);
    const { data: dishes, error: dishError } = await supabase
      .from("dishes")
      .select("id, name, price, has_options")
      .in("id", dishIds);

    if (dishError || !dishes) {
      return new Response(JSON.stringify({ error: "Failed to validate dishes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dishMap = new Map(dishes.map((d: any) => [d.id, d]));

    // Fetch all options for dishes that have them
    const dishesWithOptions = dishes.filter((d: any) => d.has_options).map((d: any) => d.id);
    let optionsMap = new Map();
    if (dishesWithOptions.length > 0) {
      const { data: options } = await supabase
        .from("dish_options")
        .select("id, dish_id, name, price")
        .in("dish_id", dishesWithOptions);
      options?.forEach((o: any) => {
        optionsMap.set(`${o.dish_id}:${o.name}`, o);
      });
    }

    // Build validated order items and compute total
    let totalCents = 0;
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

      // TODO: validate modifier prices similarly if needed
      const modifierNames = item.selected_modifier_names || [];
      // For now trust modifier subtotals from client (modifier price validation can be added)
      
      const quantity = Math.max(1, Math.min(99, parseInt(item.quantity) || 1));
      const subtotalCents = unitPriceCents * quantity;
      totalCents += subtotalCents;

      validatedItems.push({
        dish_id: item.dish_id,
        dish_name: dish.name,
        quantity,
        unit_price_cents: unitPriceCents,
        selected_option_name: optionName,
        selected_modifier_names: modifierNames,
        subtotal_cents: subtotalCents,
        special_instructions: item.special_instructions || null,
        station: "kitchen",
      });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id,
        table_id: tableId,
        guest_name,
        guest_phone: guest_phone || null,
        payment_method: payment_method || "pay_at_table",
        total_cents: totalCents,
        notes: notes || null,
        status: "pending",
        payment_status: payment_method === "pay_at_table" ? "unpaid" : "unpaid",
      })
      .select("id, session_token")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    return new Response(
      JSON.stringify({
        order_id: order.id,
        session_token: order.session_token,
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
