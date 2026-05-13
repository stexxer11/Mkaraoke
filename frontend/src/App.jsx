import { BrowserRouter, Routes, Route } from "react-router-dom"

import BackendGate from "./components/BackendGate"

import MobilePage from "./pages/MobilePage"
import TvPage from "./pages/TvPage"
import AdminPage from "./pages/AdminPage"

function App() {
  return (
    <BackendGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MobilePage />} />
          <Route path="/tv" element={<TvPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </BackendGate>
  )
}

export default App