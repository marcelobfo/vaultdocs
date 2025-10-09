import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  companyId: string;
  fileName: string;
  expiresAt?: string;
  daysRemaining?: number;
  customMessage?: string;
  recipientEmail: string;
  notificationType: "expiration" | "new_file";
  uploadedBy?: string;
  folderName?: string;
  fileId?: string;
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

    const {
      companyId,
      fileName,
      expiresAt,
      daysRemaining,
      customMessage,
      recipientEmail,
      notificationType,
      uploadedBy,
      folderName,
      fileId,
    }: NotificationEmailRequest = await req.json();

    // Buscar dados da empresa
    const { data: company } = await supabaseClient
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    let subject = "";
    let html = "";

    if (notificationType === "expiration") {
      subject = `[${company?.name}] - Arquivo próximo do vencimento`;
      html = `
        <h1>Arquivo próximo do vencimento</h1>
        <p>Olá,</p>
        <p>O arquivo <strong>"${fileName}"</strong> da empresa ${company?.name} está próximo da data de expiração.</p>
        <p><strong>Data de expiração:</strong> ${expiresAt}</p>
        <p><strong>Dias restantes:</strong> ${daysRemaining}</p>
        ${customMessage ? `<p>${customMessage}</p>` : ""}
        <p>Acesse o sistema para renovar ou arquivar o documento.</p>
      `;
    } else if (notificationType === "new_file") {
      subject = `[${company?.name}] - Novo arquivo adicionado`;
      html = `
        <h1>Novo arquivo adicionado</h1>
        <p>Olá,</p>
        <p>Um novo arquivo foi adicionado à empresa ${company?.name}.</p>
        <p><strong>Nome do arquivo:</strong> ${fileName}</p>
        ${folderName ? `<p><strong>Pasta:</strong> ${folderName}</p>` : ""}
        ${uploadedBy ? `<p><strong>Enviado por:</strong> ${uploadedBy}</p>` : ""}
        <p>Acesse o sistema para visualizar.</p>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "VaultDocs <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Registrar log
    await supabaseClient.from("notification_logs").insert({
      company_id: companyId,
      notification_type: notificationType,
      recipient_email: recipientEmail,
      file_id: fileId,
      status: "sent",
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email:", error);

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
