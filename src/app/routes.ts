import { createBrowserRouter } from "react-router";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ReunioesPage from "./pages/ReunioesPage";
import ChatPage from "./pages/ChatPage";
import DocumentosPage from "./pages/DocumentosPage";
import AuditoriasPage from "./pages/AuditoriasPage";
import AuditReportPage from "./pages/AuditReportPage";
import AuditClosurePage from "./pages/AuditClosurePage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ClientesPage from "./pages/ClientesPage";
import ProjetosPage from "./pages/ProjetosPage";
import PipelineCustomPage from "./pages/PipelineCustomPage";

import LoginPage from "./pages/LoginPage";

import RelatoriosPage from "./pages/RelatoriosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";

import NormasPage from "./pages/NormasPage";
import TreinamentosPage from "./pages/TreinamentosPage";
import CalendarioPage from "./pages/CalendarioPage";
import ClientePerfilPage from "./pages/ClientePerfilPage";
import ContatoPerfilPage from "./pages/ContatoPerfilPage";
import ChatbotConfigPage from "./pages/ChatbotConfigPage";
import ConsultoresPage from "./pages/ConsultoresPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import PropostasPage from "./pages/PropostasPage";
import PropostaTestPage from "./pages/PropostaTestPage";
import PropostasTestPage from "./pages/PropostasTestPage";

export const router = createBrowserRouter([
  // Public route — no layout
  { path: "/login", Component: LoginPage },
  { path: "/proposta-test", Component: PropostaTestPage },
  { path: "/propostas-test", Component: PropostasTestPage },

  // Protected app routes — with layout
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "reunioes", Component: ReunioesPage },
      { path: "chat", Component: ChatPage },
      { path: "chatbot", Component: ChatbotConfigPage },

      { path: "clientes", Component: ClientesPage },
      { path: "clientes/:id", Component: ClientePerfilPage },
      { path: "contatos/:id", Component: ContatoPerfilPage },
      { path: "perfil/:phone", Component: ContatoPerfilPage },
      { path: "projetos", Component: ProjetosPage },
      { path: "projetos/p/:id", Component: PipelineCustomPage },
      { path: "documentos", Component: DocumentosPage },
      { path: "auditorias", Component: AuditoriasPage },
      { path: "auditorias/rai", Component: AuditReportPage },
      { path: "auditorias/fechamento", Component: AuditClosurePage },
      { path: "calendario", Component: CalendarioPage },
      { path: "normas", Component: NormasPage },
      { path: "treinamentos", Component: TreinamentosPage },
      { path: "consultores", Component: ConsultoresPage },
      { path: "financeiro", Component: FinanceiroPage },
      { path: "propostas", Component: PropostasPage },

      { path: "relatorios", Component: RelatoriosPage },
      { path: "configuracoes", Component: ConfiguracoesPage },
      { path: "*", Component: PlaceholderPage },
    ],
  },
]);
