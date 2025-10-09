import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting expiration check...");

    // Buscar todas as empresas com notificações ativas
    const { data: companies } = await supabaseClient
      .from("notification_settings")
      .select("company_id, expiration_days_before, custom_message, notify_expiration")
      .eq("notify_expiration", true);

    if (!companies || companies.length === 0) {
      console.log("No companies with expiration notifications enabled");
      return new Response(
        JSON.stringify({ message: "No companies to process" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let totalNotifications = 0;

    for (const company of companies) {
      const daysAhead = company.expiration_days_before || 7;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      // Buscar arquivos expirando
      const { data: files } = await supabaseClient
        .from("files")
        .select("id, name, expires_at, company_id")
        .eq("company_id", company.company_id)
        .is("deleted_at", null)
        .gte("expires_at", new Date().toISOString())
        .lte("expires_at", targetDate.toISOString());

      if (!files || files.length === 0) continue;

      // Buscar usuários da empresa
      const { data: userCompanies } = await supabaseClient
        .from("user_companies")
        .select("user_id")
        .eq("company_id", company.company_id);

      if (!userCompanies) continue;

      const userIds = userCompanies.map((uc) => uc.user_id);

      // Buscar emails dos usuários
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      if (!profiles) continue;

      // Enviar notificações para cada arquivo
      for (const file of files) {
        const expiresAt = new Date(file.expires_at);
        const now = new Date();
        const daysRemaining = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        for (const profile of profiles) {
          if (!profile.email) continue;

          // Enviar email
          await supabaseClient.functions.invoke("send-notification-email", {
            body: {
              companyId: file.company_id,
              fileName: file.name,
              expiresAt: expiresAt.toLocaleDateString("pt-BR"),
              daysRemaining,
              customMessage: company.custom_message,
              recipientEmail: profile.email,
              notificationType: "expiration",
              fileId: file.id,
            },
          });

          totalNotifications++;
        }

        // Disparar webhook
        await supabaseClient.functions.invoke("trigger-webhook", {
          body: {
            companyId: file.company_id,
            event: "file_expiring",
            data: {
              fileName: file.name,
              fileId: file.id,
              expiresAt: file.expires_at,
              daysRemaining,
            },
          },
        });
      }
    }

    console.log(`Sent ${totalNotifications} expiration notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: totalNotifications,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error checking expiring files:", error);
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
