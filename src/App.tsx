import { Navigate, Route, Routes } from "react-router-dom";

import AdminLogin from "./pages/admin/Login";
import AdminHome from "./pages/admin/Home";
import Dashboard from "./components/admin/Dashboard";
import UserManagement from "./components/admin/UserManagement";
// import ComingSoon from "./components/admin/Comingoon";

import Home from "./pages/client/Home";
import UserLogin from "./pages/client/Login";
import UserRegister from "./pages/client/Register";
import Checkout from "./pages/client/Checkout";
import RequireAuth from "./components/client/Requireauth";
import ProductManagement from "./components/admin/ProductManagement";
import CouponOffer from "./components/admin/CouponOffer";
import OrderManagement from "./components/admin/OrderManagement";
import Shop from "./pages/client/Shop";
import Cart from "./pages/client/Cart";
import Profile from "./pages/client/Profile";
import SingleProduct from "./pages/client/SingleProduct";
import Orders from "./pages/client/Orders";
import Report from "./components/admin/Report";
import Cms from "./components/admin/Cms";

function App() {
  return (
    <Routes>
       {/* Public: anyone can browse and fill a cart */}
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<SingleProduct />} />
      {/* TODO: replace with the real Cart page once it is built */}
      <Route path="/cart" element={<Cart/>} />
      <Route path="/login" element={<UserLogin />} />
      <Route path="/register" element={<UserRegister />} />
 
      {/* Needs a signed-in customer */}
      <Route element={<RequireAuth />}>
        <Route path="/checkout" element={<Checkout />} />
        {/* TODO: replace with the real pages once they are built */}
        <Route path="/profile" element={<Profile/>} />
        <Route path="/orders" element={<Orders/>} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminHome />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="products" element={<ProductManagement/>} />
        <Route path="orders" element={<OrderManagement />} />
        <Route path="coupons" element={<CouponOffer/>} />
        <Route path="cms" element={<Cms/>} />
        <Route path="sales" element={<Report/>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;