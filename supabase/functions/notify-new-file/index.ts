import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyNewFileRequest {
  fileId: string;
  fileName: string;
  companyId: string;
  folderId?: string;
  uploadedBy?: string;
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

    const { fileId, fileName, companyId, folderId, uploadedBy }: NotifyNewFileRequest = await req.json();

    // Verificar se notificações de novos arquivos estão ativas
    const { data: settings } = await supabaseClient
      .from("notification_settings")
      .select("notify_new_files")
      .eq("company_id", companyId)
      .single();

    if (!settings?.notify_new_files) {
      return new Response(
        JSON.stringify({ message: "New file notifications disabled" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Buscar nome da pasta
    let folderName = "Root";
    if (folderId) {
      const { data: folder } = await supabaseClient
        .from("folders")
        .select("name")
        .eq("id", folderId)
        .single();
      if (folder) folderName = folder.name;
    }

    // Buscar nome do uploader
    let uploaderName = "Sistema";
    if (uploadedBy) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("full_name, email")
        .eq("id", uploadedBy)
        .single();
      if (profile) uploaderName = profile.full_name || profile.email || "Sistema";
    }

    // Buscar usuários da empresa
    const { data: userCompanies } = await supabaseClient
      .from("user_companies")
      .select("user_id")
      .eq("company_id", companyId);

    if (!userCompanies || userCompanies.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users in company" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const userIds = userCompanies.map((uc) => uc.user_id);

    // Buscar emails
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (!profiles) {
      return new Response(
        JSON.stringify({ message: "No profiles found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let notificationsSent = 0;

    // Enviar emails
    for (const profile of profiles) {
      if (!profile.email || profile.id === uploadedBy) continue; // Não notificar quem fez upload

      await supabaseClient.functions.invoke("send-notification-email", {
        body: {
          companyId,
          fileName,
          recipientEmail: profile.email,
          notificationType: "new_file",
          uploadedBy: uploaderName,
          folderName,
          fileId,
        },
      });

      notificationsSent++;
    }

    // Disparar webhook
    await supabaseClient.functions.invoke("trigger-webhook", {
      body: {
        companyId,
        event: "new_file",
        data: {
          fileName,
          fileId,
          uploadedBy: uploaderName,
          folderName,
        },
      },
    });

    console.log(`Sent ${notificationsSent} new file notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-new-file:", error);
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
