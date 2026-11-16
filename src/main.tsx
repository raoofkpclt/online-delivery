import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./routes/AuthContext.tsx";
import { CartProvider } from "./routes/client/ Cartcontext.tsx";
import ScrollToTop from "./components/client/ScrollToTop.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
         <CartProvider>
         <ScrollToTop />
        <App />
        
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);