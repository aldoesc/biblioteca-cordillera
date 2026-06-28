import { Link } from 'react-router-dom';
import PaymentMethods from './PaymentMethods';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-pay">
          <span className="footer-label">Medios de pago</span>
          <PaymentMethods />
        </div>
        <nav className="footer-links">
          <Link to="/terminos">Términos y Condiciones</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/devoluciones">Cambios y Devoluciones</Link>
          <Link to="/reclamaciones" className="reclamos-link">📕 Libro de Reclamaciones</Link>
        </nav>
        <p className="footer-copy">© {year} Biblioteca Cordillera · Libros nuevos y usados</p>
      </div>
    </footer>
  );
}
