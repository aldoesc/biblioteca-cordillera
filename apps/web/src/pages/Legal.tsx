import { useSeo } from '../useSeo';

// NOTA: estos textos son plantillas base. Reemplazá los datos entre [corchetes]
// (razón social, RUC, domicilio) por los reales y, si vendés formalmente,
// validalos con un asesor legal.

function Wrap({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  useSeo(`${titulo} | Biblioteca Cordillera`);
  return (
    <div className="legal">
      <h1>{titulo}</h1>
      {children}
      <p className="hint">Última actualización: junio 2026 · Biblioteca Cordillera</p>
    </div>
  );
}

export function Terminos() {
  return (
    <Wrap titulo="Términos y Condiciones">
      <p>Bienvenido a <strong>Biblioteca Cordillera</strong>. Al usar este sitio y realizar
        compras, aceptás estos términos.</p>
      <h3>1. Productos</h3>
      <p>Vendemos libros nuevos y usados. Los ejemplares usados pueden presentar marcas de uso;
        su estado se describe e ilustra con fotos en cada ficha. Cada libro es, en general, un
        ejemplar único: la disponibilidad puede cambiar.</p>
      <h3>2. Precios y pagos</h3>
      <p>Los precios están en soles (S/) e incluyen los impuestos aplicables. Aceptamos pagos por
        MercadoPago (tarjetas, Yape y otros) y criptomonedas (para compras desde S/ 50). El pedido
        se confirma una vez acreditado el pago.</p>
      <h3>3. Envíos</h3>
      <p>Coordinamos la entrega con los datos que proporcionás al comprar. Los plazos y costos de
        envío se informan según tu ubicación.</p>
      <h3>4. Responsabilidad</h3>
      <p>Nos esforzamos por que la información sea correcta, pero pueden existir errores. Ante
        cualquier inconveniente, contactanos y lo resolvemos.</p>
      <h3>5. Contacto</h3>
      <p>Para consultas: <strong>inhouseartesanal@gmail.com</strong> · Tel./WhatsApp:
        <strong> 915964917</strong>.</p>
      <p>Responsable: Aldo Escobar (C.E. 004615362) · Domicilio: Quetzal 119, Santa Anita, Lima,
        Perú. Venta a título personal de libros nuevos y usados.</p>
    </Wrap>
  );
}

export function Privacidad() {
  return (
    <Wrap titulo="Política de Privacidad">
      <p>En <strong>Biblioteca Cordillera</strong> cuidamos tus datos personales.</p>
      <h3>1. Qué datos recopilamos</h3>
      <p>Los que nos brindás para crear tu cuenta y comprar: nombre, correo, teléfono y dirección
        de envío. Para los pagos, los datos de tarjeta los procesa la pasarela (MercadoPago), no
        los almacenamos nosotros.</p>
      <h3>2. Para qué los usamos</h3>
      <p>Para procesar tus pedidos, coordinar la entrega, y comunicarnos con vos sobre tus compras.
        No vendemos ni cedemos tus datos a terceros con fines comerciales.</p>
      <h3>3. Con quién los compartimos</h3>
      <p>Solo con los proveedores necesarios para operar (pasarelas de pago, servicio de envío).</p>
      <h3>4. Tus derechos</h3>
      <p>Podés solicitar acceder, rectificar o eliminar tus datos escribiéndonos a
        <strong> inhouseartesanal@gmail.com</strong>.</p>
      <h3>5. Seguridad</h3>
      <p>Tu contraseña se guarda cifrada y los pagos se validan con mecanismos de firma. Aun así,
        ningún sistema es 100% infalible.</p>
    </Wrap>
  );
}

export function Devoluciones() {
  return (
    <Wrap titulo="Política de Cambios y Devoluciones">
      <p>Queremos que estés conforme con tu compra en <strong>Biblioteca Cordillera</strong>.</p>
      <h3>1. Plazo</h3>
      <p>Podés solicitar un cambio o devolución dentro de los <strong>7 días</strong> de recibido
        el producto, conforme a la normativa de protección al consumidor.</p>
      <h3>2. Condiciones</h3>
      <p>El libro debe estar en el mismo estado en que lo recibiste. Para libros usados, tené en
        cuenta el estado descrito y las fotos publicadas al momento de la compra.</p>
      <h3>3. Producto con falla o error</h3>
      <p>Si recibiste un libro distinto al pedido o con un defecto no informado, te lo cambiamos o
        devolvemos el importe, sin costo para vos.</p>
      <h3>4. Cómo solicitarlo</h3>
      <p>Escribinos a <strong>inhouseartesanal@gmail.com</strong> con tu número de pedido y el motivo.
        Coordinamos la solución a la brevedad.</p>
      <h3>5. Reembolsos</h3>
      <p>Los reembolsos se realizan por el mismo medio de pago utilizado, una vez verificada la
        devolución.</p>
    </Wrap>
  );
}
