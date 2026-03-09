import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Sends an email notification to the restaurant owner when a new order is placed.
 * Called internally by create-order after successful order insertion.
 */
serve(async (req) => {
  try {
    const { order_id, restaurant_id } = await req.json();
    if (!order_id || !restaurant_id) {
      return new Response("Missing params", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get order details
    const { data: order } = await supabase
      .from("orders")
      .select("id, guest_name, total_cents, tax_cents, notes, created_at, status")
      .eq("id", order_id)
      .single();

    if (!order) return new Response("Order not found", { status: 404 });

    // Get restaurant + owner email
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, owner_id")
      .eq("id", restaurant_id)
      .single();

    if (!restaurant) return new Response("Restaurant not found", { status: 404 });

    // Get owner email from auth
    const { data: { user } } = await supabase.auth.admin.getUserById(restaurant.owner_id);
    if (!user?.email) return new Response("Owner email not found", { status: 404 });

    // Get order items
    const { data: items } = await supabase
      .from("order_items")
      .select("dish_name, quantity, unit_price_cents, selected_option_name, selected_modifier_names")
      .eq("order_id", order_id);

    const itemsHtml = (items || []).map(i => {
      let line = `${i.quantity}× ${i.dish_name}`;
      if (i.selected_option_name) line += ` (${i.selected_option_name})`;
      if (i.selected_modifier_names?.length) line += ` + ${i.selected_modifier_names.join(', ')}`;
      line += ` — $${(i.unit_price_cents * i.quantity / 100).toFixed(2)}`;
      return `<li>${line}</li>`;
    }).join('');

    const totalStr = `$${(order.total_cents / 100).toFixed(2)}`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("RESEND_API_KEY not set, skipping email");
      return new Response("No email key", { status: 200 });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "MenuTap Orders <onboarding@resend.dev>",
        to: [user.email],
        subject: `🔔 New Order from ${order.guest_name} — ${totalStr}`,
        html: `
          <h2>New Order at ${restaurant.name}</h2>
          <p><strong>Customer:</strong> ${order.guest_name}</p>
          <p><strong>Total:</strong> ${totalStr}</p>
          ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
          <h3>Items:</h3>
          <ul>${itemsHtml}</ul>
          <p style="color:#888;font-size:12px;">Order placed at ${new Date(order.created_at).toLocaleString()}</p>
        `,
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Email sent:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notify order error:", err);
    return new Response("Error", { status: 500 });
  }
});
