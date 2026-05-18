import { BrowserRouter, Routes, Route } from "react-router-dom"

import MobilePage from "./pages/MobilePage"
import TvPage from "./pages/TvPage"
import AdminPage from "./pages/AdminPage"

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route path="/" element={<MobilePage />} />

        <Route path="/tv" element={<TvPage />} />

        <Route path="/admin" element={<AdminPage />} />

      </Routes>

    </BrowserRouter>
  )
}

export default App