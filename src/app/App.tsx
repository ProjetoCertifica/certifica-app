import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ErrorBoundary fallbackMessage="Verifique se as variáveis de ambiente (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) estão configuradas no deploy.">
      <RouterProvider router={router} />
      <Toaster />
    </ErrorBoundary>
  );
}
