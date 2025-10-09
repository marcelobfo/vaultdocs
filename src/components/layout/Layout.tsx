import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="h-14 flex items-center border-b px-4">
            <SidebarTrigger className="mr-2" />
            <div className="font-semibold">VaultDocs</div>
            <div className="ml-auto flex items-center gap-2">
              <a href="/profile">
                <Button variant="ghost" size="sm">Perfil</Button>
              </a>
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
