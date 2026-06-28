import { useState } from 'react';
import { api } from '../api';
import { useSeo } from '../useSeo';

export default function Reclamos() {
  useSeo('Libro de Reclamaciones | Biblioteca Cordillera');
  const [f, setF] = useState<Record<string, string>>({ tipo: 'reclamo', tipoDocumento: 'DNI' });
  const [enviando, setEnviando] = useState(false);
  const [numero, setNumero] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre?.trim() || !f.detalle?.trim()) {
      setError('Completá tu nombre y el detalle del reclamo.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await api.enviarReclamo(f);
      setNumero(r.numero);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar');
      setEnviando(false);
    }
  }

  if (numero) {
    return (
      <div className="legal">
        <h1>✅ Reclamo registrado</h1>
        <p>Tu solicitud quedó registrada con el <strong>N° {numero}</strong>. Te responderemos en
          un plazo máximo de <strong>30 días calendario</strong>, conforme a la normativa vigente.</p>
        <p className="hint">Guardá este número como constancia.</p>
      </div>
    );
  }

  return (
    <div className="legal">
      <h1>📕 Libro de Reclamaciones</h1>
      <p>Conforme al Código de Protección y Defensa del Consumidor (Perú). Completá el formulario y
        recibirás respuesta en un plazo máximo de 30 días calendario.</p>
      <p className="hint">Un <strong>reclamo</strong> es disconformidad con el producto/servicio.
        Una <strong>queja</strong> es malestar con la atención. Presentar un reclamo no impide
        acudir a otras vías de solución.</p>

      <form onSubmit={enviar} className="card">
        <div className="row">
          <label>Tipo
            <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option value="reclamo">Reclamo</option>
              <option value="queja">Queja</option>
            </select>
          </label>
          <label>Nombre completo *
            <input value={f.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} required />
          </label>
        </div>
        <div className="row">
          <label>Tipo de documento
            <select value={f.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value)}>
              <option value="DNI">DNI</option>
              <option value="CE">Carné de extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
            </select>
          </label>
          <label>N° de documento
            <input value={f.documento ?? ''} onChange={(e) => set('documento', e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>Teléfono
            <input value={f.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
          </label>
          <label>Correo electrónico
            <input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </label>
        </div>
        <label>Domicilio
          <input value={f.domicilio ?? ''} onChange={(e) => set('domicilio', e.target.value)} />
        </label>
        <div className="row">
          <label>Producto / servicio
            <input value={f.bien ?? ''} onChange={(e) => set('bien', e.target.value)} placeholder="Ej: libro, pedido #…" />
          </label>
          <label>Monto reclamado (S/)
            <input type="number" value={f.monto ?? ''} onChange={(e) => set('monto', e.target.value)} />
          </label>
        </div>
        <label>Detalle del reclamo *
          <textarea rows={4} value={f.detalle ?? ''} onChange={(e) => set('detalle', e.target.value)} required />
        </label>
        <label>Pedido del consumidor (qué solución esperás)
          <textarea rows={2} value={f.pedidoConsumidor ?? ''} onChange={(e) => set('pedidoConsumidor', e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </button>
      </form>
    </div>
  );
}
