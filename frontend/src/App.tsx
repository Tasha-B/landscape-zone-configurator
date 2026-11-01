import { BrowserRouter, Route, Routes } from "react-router";
import Header from "./components/Header/Header";
import { LanguageProvider } from "./lib/i18n/LanguageProvider";
import NotFoundPage from "./pages/NotFoundPage";
import PlanEditorPage from "./pages/PlanEditorPage";
import PlansPage from "./pages/PlansPage";
import ShowcasePage from "./pages/ShowcasePage";

// Pages by path. The data comes from TanStack Query, so the routes need no
// loaders. Vite serves index.html for every path in development; nginx
// gets the same rule in phase 8.
function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<ShowcasePage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/:id/edit" element={<PlanEditorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
