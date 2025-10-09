import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  companyId: string;
  event: "file_expiring" | "new_file";
  data: {
    fileName: string;
    fileId?: string;
    expiresAt?: string;
    daysRemaining?: number;
    uploadedBy?: string;
    folderName?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: WebhookPayload = await req.json();
    const { companyId } = payload;

    // Buscar configurações de webhook
    const { data: settings } = await supabaseClient
      .from("notification_settings")
      .select("webhook_url, webhook_secret")
      .eq("company_id", companyId)
      .single();

    if (!settings?.webhook_url) {
      return new Response(
        JSON.stringify({ message: "No webhook configured" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const payloadString = JSON.stringify(payload);

    // Gerar assinatura HMAC
    let signature = "";
    if (settings.webhook_secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(settings.webhook_secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payloadString)
      );
      signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Enviar webhook
    const webhookResponse = await fetch(settings.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body: payloadString,
    });

    const responseBody = await webhookResponse.text();

    console.log("Webhook triggered:", {
      url: settings.webhook_url,
      status: webhookResponse.status,
      response: responseBody,
    });

    // Registrar log
    await supabaseClient.from("webhook_logs").insert({
      company_id: companyId,
      event: payload.event === "file_expiring" ? "file_uploaded" : "file_uploaded",
      url: settings.webhook_url,
      request_body: payload,
      response_status: webhookResponse.status,
      response_body: responseBody,
    });

    return new Response(
      JSON.stringify({ success: true, status: webhookResponse.status }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error triggering webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
