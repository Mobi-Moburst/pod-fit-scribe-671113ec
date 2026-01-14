import { Toaster } from "@/components/ui/toaster";
import DemoPresentation from "./pages/DemoPresentation";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import Index from "./pages/Evaluate";
import Batch from "./pages/Batch";
import Companies from "./pages/Companies";
import History from "./pages/History";
import Reports from "./pages/Reports";
import PublicReport from "./pages/PublicReport";
import ReportPresentation from "./pages/ReportPresentation";
import Demo from "./pages/Demo";
import DemoReport from "./pages/DemoReport";
import DemoPublicReport from "./pages/DemoPublicReport";
import NotFound from "./pages/NotFound";

// Singleton pattern for QueryClient to prevent recreation during HMR
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    });
  }
  return browserQueryClient;
}

const queryClient = getQueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/batch" element={<Batch />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/history" element={<History />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/report/:slug" element={<PublicReport />} />
            <Route path="/report/:slug/present" element={<ReportPresentation />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/demo/report" element={<DemoReport />} />
            <Route path="/demo/report/public" element={<DemoPublicReport />} />
            <Route path="/demo/report/present" element={<DemoPresentation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
