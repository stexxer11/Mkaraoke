import ReactDOM from "react-dom/client"

import App from "./App"
import "./index.css"

import { KaraokeProvider }
from "./components/KaraokeContext"

ReactDOM.createRoot(
  document.getElementById("root")
).render(

  <KaraokeProvider>
    <App />
  </KaraokeProvider>

)