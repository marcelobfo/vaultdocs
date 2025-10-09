
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { signInWithPassword, resetPasswordForEmail, signUp } from "@/lib/auth";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { data, error } = await signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast({ title: "Falha no login", description: error.message });
        return;
      }
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      navigate("/dashboard", { replace: true });
      return;
    }

    // Cadastro
    const { error } = await signUp({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Falha no cadastro", description: error.message });
      return;
    }
    toast({
      title: "Verifique seu e-mail",
      description: "Enviamos um link de confirmação para concluir seu cadastro.",
    });
  }

  async function onReset() {
    if (!email) return toast({ title: "Informe o e-mail", description: "Digite seu e-mail para enviar o link." });
    const { error } = await resetPasswordForEmail(email);
    if (error) return toast({ title: "Erro", description: error.message });
    toast({ title: "Verifique seu e-mail", description: "Enviamos o link de recuperação." });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <SEO title="Login | VaultDocs" description="Acesse seu painel para gerenciar documentos com segurança." />
      <div className="glass-card rounded-lg p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
          <button
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "Criar conta" : "Já tenho conta"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Use seu e-mail e senha para acessar." : "Crie sua conta com e-mail e senha."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading} variant="hero">
            {loading ? (mode === "login" ? "Entrando..." : "Criando...") : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        {mode === "login" && (
          <button onClick={onReset} className="mt-4 text-sm text-primary underline-offset-4 hover:underline">
            Esqueci minha senha
          </button>
        )}
      </div>
    </div>
  );
}
