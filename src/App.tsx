import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import EmbedDemo from "./pages/EmbedDemo";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/states" element={<Index />} />
        <Route path="/districts" element={<Index />} />
        <Route path="/regions" element={<Index />} />
        <Route path="/state-districts" element={<Index />} />
        <Route path="/sub-admin" element={<Index />} />
        <Route path="/electoral" element={<Index />} />
        <Route path="/environment" element={<Index />} />
        <Route path="/district-stats" element={<Index />} />
        <Route path="/help" element={<Index />} />
        <Route path="/credits" element={<Index />} />
        <Route path="/mcp" element={<Index />} />
        <Route path="/pincodes" element={<Index />} />
        <Route path="/urban" element={<Index />} />
        <Route path="/cities" element={<Index />} />
        <Route path="/city-stats" element={<Index />} />
        <Route path="/evolution" element={<Index />} />
        <Route path="/census" element={<Index />} />
        <Route path="/api" element={<Index />} />
        <Route path="/maps" element={<Index />} />
        <Route path="/health" element={<Index />} />
        <Route path="/embed-demo" element={<EmbedDemo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
