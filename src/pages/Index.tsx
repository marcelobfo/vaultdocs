import heroImg from "@/assets/hero-dashboard.jpg";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const Index = () => {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background">
      <SEO title="VaultDocs – Gestão de Documentos" description="Organize empresas, pastas e arquivos com upload seguro e visualização moderna." />
      <div className="absolute inset-0">
        <img src={heroImg} alt="Hero – gestão de documentos" className="w-full h-full object-cover opacity-40" loading="lazy" />
      </div>
      <div className="absolute inset-0 bg-hero-gradient opacity-40" />

      <div className="relative z-10 text-center max-w-3xl px-6">
        <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight">Centralize e compartilhe documentos com segurança</h1>
        <p className="text-lg text-muted-foreground mb-8">Crie pastas por empresa, faça upload de PDFs, imagens e mais, com um dashboard moderno e responsivo.</p>
        <div className="flex items-center justify-center gap-3">
          <a href="/login"><Button variant="hero" size="lg">Entrar</Button></a>
          <a href="/dashboard"><Button variant="outline" size="lg">Explorar</Button></a>
        </div>
      </div>
    </div>
  );
};

export default Index;
