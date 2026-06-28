import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import BookList from './pages/BookList';
import AddBook from './pages/AddBook';
import BookDetail from './pages/BookDetail';
import Store from './pages/Store';
import StoreItem from './pages/StoreItem';
import Collection from './pages/Collection';
import Login from './pages/Login';
import Cart from './pages/Cart';
import CheckoutResult from './pages/CheckoutResult';
import Orders from './pages/Orders';
import AdminOrders from './pages/AdminOrders';
import AdminReclamos from './pages/AdminReclamos';
import Reclamos from './pages/Reclamos';
import { Terminos, Privacidad, Devoluciones } from './pages/Legal';
import RequireAdmin from './components/RequireAdmin';
import { AuthProvider } from './auth';
import './styles.css';

const admin = (el: React.ReactNode) => <RequireAdmin>{el}</RequireAdmin>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // La colección (biblioteca completa) es la portada
      { index: true, element: <Collection /> },
      { path: 'coleccion', element: <Collection /> },
      { path: 'coleccion/:id', element: <StoreItem /> },
      { path: 'tienda', element: <Store /> },
      { path: 'tienda/:id', element: <StoreItem /> },
      { path: 'login', element: <Login /> },
      { path: 'carrito', element: <Cart /> },
      { path: 'checkout/resultado', element: <CheckoutResult /> },
      { path: 'pedidos', element: <Orders /> },
      { path: 'reclamaciones', element: <Reclamos /> },
      { path: 'terminos', element: <Terminos /> },
      { path: 'privacidad', element: <Privacidad /> },
      { path: 'devoluciones', element: <Devoluciones /> },
      // Área de administración (solo admin)
      { path: 'admin', element: admin(<BookList />) },
      { path: 'admin/nuevo', element: admin(<AddBook />) },
      { path: 'admin/libro/:id', element: admin(<BookDetail />) },
      { path: 'admin/pedidos', element: admin(<AdminOrders />) },
      { path: 'admin/reclamos', element: admin(<AdminReclamos />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
