import { BrowserRouter, Routes, Route } from "react-router-dom"

import MobilePage from "./components/MobilePage"
import TvPage from "./components/TvPage"
import AdminPage from "./components/AdminPage"

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