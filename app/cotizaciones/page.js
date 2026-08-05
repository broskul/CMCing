'use client';

import { useCallback, useEffect, useState } from 'react';
import { ComboBox } from '../components/ComboBox';

const money = (value) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const number = (value) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(value) || 0);

const statusOptions = [
  { id: 'borrador', label: 'Borrador', description: 'Aún no enviada al cliente.' },
  { id: 'enviada', label: 'Enviada', description: 'Esperando respuesta del cliente.' },
  { id: 'aprobada', label: 'Aprobada', description: 'Aceptada comercialmente.' },
  { id: 'rechazada', label: 'Rechazada', description: 'No aceptada por el cliente.' },
  { id: 'vencida', label: 'Vencida', description: 'Superó la fecha de vigencia.' },
];

function calendarDateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyService() {
  return {
    servicioId: '',
    descripcionDetalle: '',
    cantidad: 1,
    precioUnitario: 0,
    descuentoTipo: 'porcentaje',
    descuentoValor: 0,
  };
}

function emptyItem() {
  return {
    equipoId: '',
    servicios: [emptyService()],
  };
}

function emptyForm() {
  return {
    clienteId: '',
    vendedorId: '',
    validaHasta: calendarDateAfter(7),
    estado: 'borrador',
    observaciones: '',
    impuestoPct: 19,
    descuentoGlobalTipo: 'porcentaje',
    descuentoGlobalValor: 0,
    items: [emptyItem()],
  };
}

function quoteForm(cotizacion) {
  if (!cotizacion) return emptyForm();

  return {
    clienteId: String(cotizacion.clienteId || ''),
    vendedorId: cotizacion.vendedorId ? String(cotizacion.vendedorId) : '',
    validaHasta: String(cotizacion.validaHasta || '').slice(0, 10),
    estado: cotizacion.estado || 'borrador',
    observaciones: cotizacion.observaciones || '',
    impuestoPct: Number(cotizacion.impuestoPct ?? 19),
    descuentoGlobalTipo: cotizacion.descuentoGlobalTipo === 'monto' ? 'monto' : 'porcentaje',
    descuentoGlobalValor: Number(cotizacion.descuentoGlobalValor ?? cotizacion.descuentoGlobalPct ?? 0),
    items: (cotizacion.items?.length ? cotizacion.items : [emptyItem()]).map((item) => {
      const legacyService = item.servicioId ? [{
        servicioId: String(item.servicioId),
        descripcionDetalle: item.descripcion || '',
        cantidad: Number(item.cantidad ?? 1),
        precioUnitario: Number(item.precioUnitario ?? 0),
        descuentoTipo: item.descuentoTipo === 'monto' ? 'monto' : 'porcentaje',
        descuentoValor: Number(item.descuentoValor ?? item.descuentoPct ?? 0),
      }] : [emptyService()];

      return {
        id: item.id,
        equipoId: item.equipoId ? String(item.equipoId) : '',
        servicios: (item.servicios?.length ? item.servicios : legacyService).map((service) => ({
          id: service.id,
          servicioId: service.servicioId ? String(service.servicioId) : '',
          descripcionDetalle: service.descripcionDetalle || '',
          cantidad: Number(service.cantidad ?? 1),
          precioUnitario: Number(service.precioUnitario ?? 0),
          descuentoTipo: service.descuentoTipo === 'monto' ? 'monto' : 'porcentaje',
          descuentoValor: Number(service.descuentoValor ?? service.descuentoPct ?? 0),
        })),
      };
    }),
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateService(service) {
  const cantidad = Math.max(0, toNumber(service.cantidad));
  const precioUnitario = Math.max(0, toNumber(service.precioUnitario));
  const bruto = Math.round(cantidad * precioUnitario);
  const descuentoTipo = service.descuentoTipo === 'monto' ? 'monto' : 'porcentaje';
  const descuentoValor = Math.max(0, toNumber(service.descuentoValor));
  const descuentoMonto = descuentoTipo === 'monto'
    ? Math.min(bruto, descuentoValor)
    : Math.round(bruto * Math.min(descuentoValor, 100) / 100);

  return {
    ...service,
    cantidad,
    precioUnitario,
    bruto,
    descuentoTipo,
    descuentoValor: descuentoTipo === 'monto' ? descuentoValor : Math.min(descuentoValor, 100),
    descuentoMonto,
    descuentoPct: bruto > 0 ? Math.round((descuentoMonto * 10000) / bruto) / 100 : 0,
    lineaTotal: Math.max(0, bruto - descuentoMonto),
  };
}

function calculateQuote(form) {
  const items = (form.items || []).map((item, index) => {
    const servicios = (item.servicios || []).map(calculateService);
    return {
      ...item,
      orden: index + 1,
      servicios,
      bruto: servicios.reduce((total, service) => total + service.bruto, 0),
      descuentoMonto: servicios.reduce((total, service) => total + service.descuentoMonto, 0),
      lineaTotal: servicios.reduce((total, service) => total + service.lineaTotal, 0),
    };
  });

  const subtotal = items.reduce((total, item) => total + item.lineaTotal, 0);
  const descuentoGlobalTipo = form.descuentoGlobalTipo === 'monto' ? 'monto' : 'porcentaje';
  const descuentoGlobalValor = Math.max(0, toNumber(form.descuentoGlobalValor));
  const descuentoMonto = descuentoGlobalTipo === 'monto'
    ? Math.min(subtotal, descuentoGlobalValor)
    : Math.round(subtotal * Math.min(descuentoGlobalValor, 100) / 100);
  const neto = Math.max(0, subtotal - descuentoMonto);
  const impuestoPct = Math.max(0, toNumber(form.impuestoPct));
  const impuestoMonto = Math.round(neto * impuestoPct / 100);

  return {
    items,
    subtotal,
    descuentoGlobalTipo,
    descuentoGlobalValor: descuentoGlobalTipo === 'monto' ? descuentoGlobalValor : Math.min(descuentoGlobalValor, 100),
    descuentoMonto,
    neto,
    impuestoPct,
    impuestoMonto,
    total: neto + impuestoMonto,
  };
}

function dateLabel(value) {
  if (!value) return 'Sin fecha de vigencia';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sin fecha de vigencia';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function statusLabel(value) {
  return statusOptions.find((option) => option.id === value)?.label || value || 'Sin estado';
}

function discountLabel(type, value) {
  return type === 'monto' ? money(value) : `${number(value)} %`;
}

function equipmentDescription(equipment) {
  return [
    equipment.partNumber ? `Part-number: ${equipment.partNumber}` : '',
    equipment.ean ? `EAN: ${equipment.ean}` : '',
    equipment.serial ? `Serie: ${equipment.serial}` : '',
    equipment.codigoInterno ? `Código: ${equipment.codigoInterno}` : '',
  ].filter(Boolean).join(' · ') || equipment.modelo || 'Equipo';
}

function equipmentSearchText(equipment) {
  return [equipment.nombre, equipment.partNumber, equipment.ean, equipment.serial, equipment.codigoInterno].filter(Boolean).join(' ');
}

function serviceCount(quote) {
  return (quote.items || []).reduce((total, item) => total + (item.servicios?.length || (item.servicioId ? 1 : 0)), 0);
}

function Field({ label, required = false, children, className = '' }) {
  return (
    <label className={`quote-field block text-[0.84rem] font-semibold text-neutral-700 ${className}`}>
      <span className="quote-field-label">{label}{required ? <span className="quote-required-marker" aria-hidden="true"> *</span> : null}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function DiscountControl({ label, type, value, onTypeChange, onValueChange }) {
  const isAmount = type === 'monto';

  return (
    <div className="quote-discount-control">
      <span className="quote-field-label">{label}</span>
      <div className="mt-1.5 flex gap-2">
        <div className="quote-discount-mode" aria-label={`${label}: tipo de descuento`}>
          <button type="button" onClick={() => onTypeChange('porcentaje')} className={!isAmount ? 'is-active' : ''} aria-pressed={!isAmount}>%</button>
          <button type="button" onClick={() => onTypeChange('monto')} className={isAmount ? 'is-active' : ''} aria-pressed={isAmount}>$</button>
        </div>
        <input
          type="number"
          min="0"
          max={isAmount ? undefined : 100}
          step={isAmount ? 1000 : 0.01}
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="input-base min-w-0"
          aria-label={`${label} en ${isAmount ? 'pesos' : 'porcentaje'}`}
        />
      </div>
    </div>
  );
}

function QuoteTotals({ totals }) {
  return (
    <aside className="quote-totals" aria-label="Resumen de montos">
      <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
      <div><span>Descuento general ({discountLabel(totals.descuentoGlobalTipo, totals.descuentoGlobalValor)})</span><strong>- {money(totals.descuentoMonto)}</strong></div>
      <div><span>Neto</span><strong>{money(totals.neto)}</strong></div>
      <div><span>IVA ({number(totals.impuestoPct)} %)</span><strong>{money(totals.impuestoMonto)}</strong></div>
      <div className="quote-totals-total"><span>Total</span><strong>{money(totals.total)}</strong></div>
    </aside>
  );
}

function QuoteEditorDialog({ editor, options, saving, onChange, onItemChange, onServiceChange, onAddItem, onRemoveItem, onAddService, onRemoveService, onClose, onSubmit }) {
  const form = editor.form;
  const totals = calculateQuote(form);
  const isEdit = editor.mode === 'edit';
  const activeServices = options.servicios.filter((service) => service.activo !== false);

  return (
    <div className="entity-modal-backdrop quote-dialog-backdrop" role="presentation">
      <section className="entity-modal quote-editor-modal" role="dialog" aria-modal="true" aria-labelledby="quote-editor-title">
        <header className="entity-modal-header">
          <div>
            <p>Comercial · cotizaciones</p>
            <h3 id="quote-editor-title">{isEdit ? `Editar ${editor.quote?.numero || 'cotización'}` : 'Nueva cotización'}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={saving}>Cerrar</button>
        </header>

        <form className="quote-editor-form" onSubmit={onSubmit}>
          {editor.error ? <p role="alert" className="quote-form-error">{editor.error}</p> : null}

          <section className="quote-section">
            <div className="quote-section-heading">
              <div><p>Encabezado</p><h4>Datos de la cotización</h4></div>
              {isEdit ? <span className="quote-number-chip">{editor.quote?.numero || 'Sin folio'}</span> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cliente" required>
                <ComboBox options={options.clientes} value={form.clienteId} onChange={(value) => onChange('clienteId', value)} getOptionLabel={(client) => client.nombre} getOptionDescription={(client) => client.rut || client.email || client.telefono || 'Cliente'} placeholder="Buscar cliente..." required />
              </Field>
              <Field label="Vendedor">
                <ComboBox options={options.vendedores} value={form.vendedorId} onChange={(value) => onChange('vendedorId', value)} getOptionLabel={(seller) => seller.nombre} getOptionDescription={(seller) => seller.email || 'Vendedor'} placeholder="Buscar vendedor..." />
              </Field>
              <Field label="Válida hasta">
                <input type="date" value={form.validaHasta} onChange={(event) => onChange('validaHasta', event.target.value)} className="input-base" />
              </Field>
              <Field label="Estado" required>
                <ComboBox options={statusOptions} value={form.estado} onChange={(value) => onChange('estado', value)} getOptionLabel={(option) => option.label} getOptionDescription={(option) => option.description} placeholder="Seleccionar estado..." allowClear={false} required />
              </Field>
            </div>
          </section>

          <section className="quote-section">
            <div className="quote-section-heading quote-section-heading-actions">
              <div><p>Detalle comercial</p><h4>Ítems y servicios</h4></div>
              <button type="button" onClick={onAddItem} className="quote-add-line">＋ Agregar ítem</button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, itemIndex) => {
                const itemTotals = totals.items[itemIndex];
                const selectedEquipment = options.equipos.find((equipment) => String(equipment.id) === String(item.equipoId));
                return (
                  <article key={item.id || `item-${itemIndex}`} className="quote-item-card">
                    <div className="quote-item-header">
                      <span>Ítem {itemIndex + 1}</span>
                      <span>Resultado: <strong>{money(itemTotals.lineaTotal)}</strong></span>
                    </div>

                    <Field label="Ítem" required>
                      <ComboBox
                        options={options.equipos}
                        value={item.equipoId}
                        onChange={(value) => onItemChange(itemIndex, value)}
                        getOptionLabel={(equipment) => equipment.nombre}
                        getOptionDescription={equipmentDescription}
                        getOptionSearchText={equipmentSearchText}
                        placeholder="Buscar por nombre, part-number, EAN o número de serie..."
                        emptyText="No hay equipos que coincidan con la búsqueda."
                        required
                      />
                    </Field>
                    {selectedEquipment ? <div className="quote-item-identity"><strong>{selectedEquipment.nombre}</strong><span>{equipmentDescription(selectedEquipment)}</span></div> : null}

                    <div className="quote-services-heading">
                      <div><p>Servicios</p><span>Se cotizan bajo el ítem seleccionado.</span></div>
                      <button type="button" onClick={() => onAddService(itemIndex)} className="quote-add-service">＋ Agregar servicio</button>
                    </div>

                    <div className="quote-services">
                      {item.servicios.map((service, serviceIndex) => {
                        const serviceTotals = itemTotals.servicios[serviceIndex];
                        return (
                          <section key={service.id || `service-${itemIndex}-${serviceIndex}`} className="quote-service-card">
                            <div className="quote-service-header"><span>Servicio {serviceIndex + 1}</span><strong>{money(serviceTotals.lineaTotal)}</strong></div>
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                              <Field label="Servicio" required>
                                <ComboBox
                                  options={activeServices}
                                  value={service.servicioId}
                                  onChange={(value, selectedService) => onServiceChange(itemIndex, serviceIndex, 'servicioId', value, selectedService)}
                                  getOptionLabel={(catalogService) => catalogService.descripcion || catalogService.nombre}
                                  getOptionDescription={(catalogService) => catalogService.tipo || (catalogService.precio ? `Referencia ${money(catalogService.precio)}` : 'Servicio')}
                                  placeholder="Seleccionar servicio del catálogo..."
                                  emptyText="No hay servicios que coincidan."
                                  required
                                />
                              </Field>
                              <Field label="Descripción detallada">
                                <textarea value={service.descripcionDetalle} onChange={(event) => onServiceChange(itemIndex, serviceIndex, 'descripcionDetalle', event.target.value)} className="input-base min-h-24 resize-y" placeholder="Detalle técnico, alcance o condición específica" />
                              </Field>
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                              <Field label="Cantidad" required><input type="number" min="0.01" step="0.01" inputMode="decimal" value={service.cantidad} onChange={(event) => onServiceChange(itemIndex, serviceIndex, 'cantidad', event.target.value)} className="input-base" required /></Field>
                              <Field label="Precio unitario" required><input type="number" min="0" step="1000" inputMode="decimal" value={service.precioUnitario} onChange={(event) => onServiceChange(itemIndex, serviceIndex, 'precioUnitario', event.target.value)} className="input-base" required /></Field>
                              <DiscountControl label="Descuento del servicio" type={service.descuentoTipo} value={service.descuentoValor} onTypeChange={(value) => onServiceChange(itemIndex, serviceIndex, 'descuentoTipo', value)} onValueChange={(value) => onServiceChange(itemIndex, serviceIndex, 'descuentoValor', value)} />
                              <div className="quote-line-summary"><span>Base</span><strong>{money(serviceTotals.bruto)}</strong><span>Descuento</span><strong>- {money(serviceTotals.descuentoMonto)}</strong><span>Total servicio</span><strong>{money(serviceTotals.lineaTotal)}</strong></div>
                            </div>
                            {item.servicios.length > 1 ? <button type="button" onClick={() => onRemoveService(itemIndex, serviceIndex)} className="quote-remove-line">Eliminar servicio</button> : null}
                          </section>
                        );
                      })}
                    </div>

                    {form.items.length > 1 ? <button type="button" onClick={() => onRemoveItem(itemIndex)} className="quote-remove-line">Eliminar ítem</button> : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="quote-section">
            <div className="quote-section-heading"><div><p>Condiciones</p><h4>Descuento, impuestos y notas</h4></div></div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <DiscountControl label="Descuento general" type={form.descuentoGlobalTipo} value={form.descuentoGlobalValor} onTypeChange={(value) => onChange('descuentoGlobalTipo', value)} onValueChange={(value) => onChange('descuentoGlobalValor', value)} />
                <Field label="IVA"><input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={form.impuestoPct} onChange={(event) => onChange('impuestoPct', event.target.value)} className="input-base" /></Field>
              </div>
              <Field label="Observaciones"><textarea value={form.observaciones} onChange={(event) => onChange('observaciones', event.target.value)} className="input-base min-h-28 resize-y" placeholder="Condiciones comerciales, plazos o notas para el cliente" /></Field>
            </div>
          </section>

          <QuoteTotals totals={totals} />
          <footer className="quote-editor-footer"><button type="button" onClick={onClose} className="secondary-action" disabled={saving}>Cancelar</button><button type="submit" className="quote-primary-action" disabled={saving}>{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cotización'}</button></footer>
        </form>
      </section>
    </div>
  );
}

function QuoteResultDialog({ result, sendingMail, onClose, onOpenQuote, onExport, onPrint, onViewChange, onMailChange, onSendMail }) {
  const { quote, view, mailTo, mailCc, mailError, mailSuccess } = result;
  const title = quote.numero || `Cotización #${quote.id}`;

  return (
    <div className="entity-modal-backdrop quote-dialog-backdrop" role="presentation">
      <section className={`entity-modal quote-result-modal ${view === 'preview' ? 'is-preview' : ''}`} role="dialog" aria-modal="true" aria-labelledby="quote-result-title">
        <header className="entity-modal-header"><div><p>Documento comercial</p><h3 id="quote-result-title">{view === 'preview' ? `Vista previa · ${title}` : title}</h3></div><button type="button" onClick={onClose} disabled={sendingMail}>Cerrar</button></header>

        {view === 'preview' ? <div className="quote-pdf-preview"><div className="quote-preview-toolbar"><button type="button" className="secondary-action" onClick={() => onViewChange('actions')}>← Volver al resultado</button><button type="button" className="quote-primary-action" onClick={() => onExport(quote)}>Exportar PDF</button></div><iframe title={`Vista previa de ${title}`} src={`/api/cotizaciones/${quote.id}/pdf?disposition=inline`} className="quote-pdf-frame" /></div> : null}

        {view === 'email' ? (
          <form className="quote-email-form" onSubmit={onSendMail}>
            <div className="quote-result-intro"><span className="quote-result-icon" aria-hidden="true">✉</span><div><h4>Enviar cotización por correo</h4><p>Se enviará el PDF adjunto usando el correo comercial configurado en Microsoft 365.</p></div></div>
            {mailError ? <p role="alert" className="quote-form-error">{mailError}</p> : null}{mailSuccess ? <p className="quote-mail-success">{mailSuccess}</p> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Para" required><input type="email" multiple value={mailTo} onChange={(event) => onMailChange('mailTo', event.target.value)} className="input-base" placeholder="contacto@cliente.cl" required /></Field><Field label="Con copia"><input type="email" multiple value={mailCc} onChange={(event) => onMailChange('mailCc', event.target.value)} className="input-base" placeholder="copia@cmcing.cl" /></Field></div>
            <footer className="quote-editor-footer"><button type="button" className="secondary-action" onClick={() => onViewChange('actions')} disabled={sendingMail}>← Volver</button><button type="submit" className="quote-primary-action" disabled={sendingMail}>{sendingMail ? 'Enviando…' : 'Enviar correo con PDF'}</button></footer>
          </form>
        ) : null}

        {view === 'actions' ? <div className="quote-result-content"><div className="quote-result-intro"><span className="quote-result-icon" aria-hidden="true">✓</span><div><h4>{result.message}</h4><p>{quote.cliente?.nombre || 'Cliente'} · Total {money(quote.total)} · {quote.items?.length || 0} {quote.items?.length === 1 ? 'ítem' : 'ítems'} · {serviceCount(quote)} {serviceCount(quote) === 1 ? 'servicio' : 'servicios'}</p></div></div>{mailError ? <p role="alert" className="quote-form-error">{mailError}</p> : null}<div className="quote-result-actions"><button type="button" className="quote-primary-action" onClick={() => onOpenQuote(quote)}>Abrir cotización</button><button type="button" className="secondary-action" onClick={() => onViewChange('preview')}>Vista previa del PDF</button><button type="button" className="secondary-action" onClick={() => onExport(quote)}>Exportar PDF</button><button type="button" className="secondary-action" onClick={() => onPrint(quote)}>Imprimir</button><button type="button" className="secondary-action" onClick={() => onViewChange('email')}>Enviar por correo</button></div></div> : null}
      </section>
    </div>
  );
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [options, setOptions] = useState({ clientes: [], vendedores: [], servicios: [], equipos: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);

  const loadData = useCallback(async () => {
    const responses = await Promise.all([fetch('/api/cotizaciones'), fetch('/api/clientes'), fetch('/api/vendedores'), fetch('/api/servicios'), fetch('/api/equipos')]);
    const data = await Promise.all(responses.map(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar la información comercial.');
      return body;
    }));
    setCotizaciones(data[0]);
    setOptions({ clientes: data[1], vendedores: data[2], servicios: data[3], equipos: data[4] });
  }, []);

  useEffect(() => { loadData().catch((error) => setLoadError(error.message || 'No se pudieron cargar las cotizaciones.')).finally(() => setLoading(false)); }, [loadData]);

  useEffect(() => {
    if (!editor && !result) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || saving || sendingMail) return;
      if (editor) {
        if (!editor.dirty || window.confirm('Hay cambios sin guardar. ¿Quieres cerrar la cotización?')) setEditor(null);
      } else setResult(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor, result, saving, sendingMail]);

  const openEditor = (quote = null) => { setResult(null); setEditor({ mode: quote ? 'edit' : 'create', quote, form: quoteForm(quote), dirty: false, error: '' }); };
  const closeEditor = () => { if (!editor || saving) return; if (editor.dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar la cotización?')) return; setEditor(null); };
  const changeForm = (field, value) => setEditor((current) => current ? { ...current, dirty: true, error: '', form: { ...current.form, [field]: value } } : current);
  const changeItem = (itemIndex, equipoId) => setEditor((current) => current ? { ...current, dirty: true, error: '', form: { ...current.form, items: current.form.items.map((item, index) => index === itemIndex ? { ...item, equipoId } : item) } } : current);
  const changeService = (itemIndex, serviceIndex, field, value, catalogService) => setEditor((current) => {
    if (!current) return current;
    const items = current.form.items.map((item, currentItemIndex) => {
      if (currentItemIndex !== itemIndex) return item;
      const servicios = item.servicios.map((service, currentServiceIndex) => {
        if (currentServiceIndex !== serviceIndex) return service;
        const next = { ...service, [field]: value };
        if (field === 'servicioId' && catalogService && toNumber(next.precioUnitario) === 0 && catalogService.precio !== undefined) next.precioUnitario = Number(catalogService.precio);
        return next;
      });
      return { ...item, servicios };
    });
    return { ...current, dirty: true, error: '', form: { ...current.form, items } };
  });
  const addItem = () => setEditor((current) => current ? { ...current, dirty: true, form: { ...current.form, items: [...current.form.items, emptyItem()] } } : current);
  const removeItem = (index) => setEditor((current) => current ? { ...current, dirty: true, form: { ...current.form, items: current.form.items.filter((_, itemIndex) => itemIndex !== index) } } : current);
  const addService = (itemIndex) => setEditor((current) => current ? { ...current, dirty: true, form: { ...current.form, items: current.form.items.map((item, index) => index === itemIndex ? { ...item, servicios: [...item.servicios, emptyService()] } : item) } } : current);
  const removeService = (itemIndex, serviceIndex) => setEditor((current) => current ? { ...current, dirty: true, form: { ...current.form, items: current.form.items.map((item, index) => index === itemIndex ? { ...item, servicios: item.servicios.filter((_, serviceIndexCurrent) => serviceIndexCurrent !== serviceIndex) } : item) } } : current);

  const saveQuote = async (event) => {
    event.preventDefault();
    if (!editor) return;
    const calculated = calculateQuote(editor.form);
    const payload = {
      clienteId: Number(editor.form.clienteId), vendedorId: editor.form.vendedorId ? Number(editor.form.vendedorId) : null, fecha: editor.quote?.fecha || new Date().toISOString(), validaHasta: editor.form.validaHasta || null, estado: editor.form.estado, moneda: 'CLP', observaciones: editor.form.observaciones.trim() || null, impuestoPct: calculated.impuestoPct, descuentoGlobalTipo: calculated.descuentoGlobalTipo, descuentoGlobalValor: calculated.descuentoGlobalValor, descuentoGlobalPct: calculated.descuentoGlobalTipo === 'porcentaje' ? calculated.descuentoGlobalValor : 0,
      items: calculated.items.map((item, itemIndex) => ({ equipoId: item.equipoId ? Number(item.equipoId) : null, orden: itemIndex + 1, servicios: item.servicios.map((service, serviceIndex) => ({ servicioId: service.servicioId ? Number(service.servicioId) : null, descripcionDetalle: service.descripcionDetalle.trim() || null, cantidad: service.cantidad, precioUnitario: service.precioUnitario, descuentoTipo: service.descuentoTipo, descuentoValor: service.descuentoValor, descuentoPct: service.descuentoPct, orden: serviceIndex + 1 })) })),
    };
    setSaving(true);
    setEditor((current) => current ? { ...current, error: '' } : current);
    try {
      const endpoint = editor.quote ? `/api/cotizaciones/${editor.quote.id}` : '/api/cotizaciones';
      const response = await fetch(endpoint, { method: editor.quote ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const quote = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(quote.error || 'No se pudo guardar la cotización.');
      setEditor(null);
      setResult({ quote, view: 'actions', message: editor.quote ? 'Cotización actualizada correctamente' : 'Cotización creada correctamente', mailTo: quote.cliente?.email || '', mailCc: '', mailError: '', mailSuccess: '' });
      loadData().catch((error) => setLoadError(error.message || 'La cotización se guardó, pero el listado no se pudo actualizar.'));
    } catch (error) { setEditor((current) => current ? { ...current, error: error.message || 'No se pudo guardar la cotización.' } : current); } finally { setSaving(false); }
  };

  const exportPdf = async (quote) => {
    try {
      const response = await fetch(`/api/cotizaciones/${quote.id}/pdf`);
      if (!response.ok) throw new Error('No se pudo exportar el PDF.');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `cotizacion_${quote.numero || quote.id}.pdf`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setResult((current) => current ? { ...current, view: 'actions', mailError: error.message || 'No se pudo exportar el PDF.' } : current); }
  };
  const printQuote = (quote) => { const printWindow = window.open(`/api/cotizaciones/${quote.id}/pdf?disposition=inline`, '_blank'); if (!printWindow) { setResult((current) => current ? { ...current, view: 'actions', mailError: 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo otra vez.' } : current); return; } printWindow.addEventListener('load', () => printWindow.print(), { once: true }); };
  const changeResult = (field, value) => setResult((current) => current ? { ...current, [field]: value, mailError: '', mailSuccess: field === 'view' ? '' : current.mailSuccess } : current);
  const sendMail = async (event) => {
    event.preventDefault(); if (!result) return; setSendingMail(true); setResult((current) => current ? { ...current, mailError: '', mailSuccess: '' } : current);
    try { const response = await fetch(`/api/cotizaciones/${result.quote.id}/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: result.mailTo, cc: result.mailCc || undefined }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'No se pudo enviar el correo.'); setResult((current) => current ? { ...current, mailSuccess: 'Correo enviado correctamente con el PDF adjunto.' } : current); } catch (error) { setResult((current) => current ? { ...current, mailError: error.message || 'No se pudo enviar el correo.' } : current); } finally { setSendingMail(false); }
  };

  return (
    <div className="min-h-screen p-4 md:p-8"><main className="mx-auto max-w-7xl space-y-6">
      <header className="panel quote-page-header p-5 md:p-7"><div><p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-sky-700">Comercial · 360°</p><h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight text-neutral-950">Cotizaciones</h1><p className="mt-2 max-w-2xl text-[0.92rem] text-neutral-600">Gestiona ítems, sus servicios, descuentos y documento comercial sin salir del listado.</p></div><button type="button" onClick={() => openEditor()} className="quote-primary-action">＋ Crear nueva cotización</button></header>
      <section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 md:px-6"><div><h2 className="text-[1.05rem] font-semibold text-neutral-950">Listado de cotizaciones</h2><p className="mt-0.5 text-[0.82rem] text-neutral-500">{loading ? 'Cargando…' : `${cotizaciones.length} ${cotizaciones.length === 1 ? 'cotización' : 'cotizaciones'} registradas`}</p></div><button type="button" onClick={() => { setLoading(true); setLoadError(''); loadData().catch((error) => setLoadError(error.message)).finally(() => setLoading(false)); }} className="secondary-action" disabled={loading}>Actualizar</button></div>
        {loadError ? <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-800">{loadError}</div> : null}{loading ? <div className="p-8 text-center text-[0.9rem] text-neutral-500">Cargando cotizaciones…</div> : null}{!loading && !cotizaciones.length ? <div className="quote-empty-state"><span aria-hidden="true">▧</span><h3>Aún no hay cotizaciones</h3><p>Crea la primera cotización para comenzar a gestionar documentos comerciales.</p><button type="button" onClick={() => openEditor()} className="quote-primary-action">Crear nueva cotización</button></div> : null}
        {!loading && cotizaciones.length ? <div className="overflow-x-auto"><table className="quote-list-table min-w-full"><thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th>Vigencia</th><th>Total</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{cotizaciones.map((quote) => <tr key={quote.id}><td><strong>{quote.numero || `COT-${quote.id}`}</strong><span>{quote.items?.length || 0} {(quote.items?.length || 0) === 1 ? 'ítem' : 'ítems'} · {serviceCount(quote)} {serviceCount(quote) === 1 ? 'servicio' : 'servicios'}</span></td><td><strong>{quote.cliente?.nombre || 'Cliente sin nombre'}</strong><span>{quote.vendedor?.nombre ? `Vendedor: ${quote.vendedor.nombre}` : 'Sin vendedor asignado'}</span></td><td><span className={`quote-status quote-status-${quote.estado || 'borrador'}`}>{statusLabel(quote.estado)}</span></td><td>{dateLabel(quote.validaHasta)}</td><td><strong>{money(quote.total)}</strong></td><td><div className="flex justify-end gap-2"><button type="button" className="secondary-action" onClick={() => openEditor(quote)}>Abrir</button><button type="button" className="quote-table-document" onClick={() => setResult({ quote, view: 'actions', message: 'Documento listo para gestionar', mailTo: quote.cliente?.email || '', mailCc: '', mailError: '', mailSuccess: '' })}>Documento</button></div></td></tr>)}</tbody></table></div> : null}
      </section>
    </main>
      {editor ? <QuoteEditorDialog editor={editor} options={options} saving={saving} onChange={changeForm} onItemChange={changeItem} onServiceChange={changeService} onAddItem={addItem} onRemoveItem={removeItem} onAddService={addService} onRemoveService={removeService} onClose={closeEditor} onSubmit={saveQuote} /> : null}
      {result ? <QuoteResultDialog result={result} sendingMail={sendingMail} onClose={() => !sendingMail && setResult(null)} onOpenQuote={openEditor} onExport={exportPdf} onPrint={printQuote} onViewChange={(view) => changeResult('view', view)} onMailChange={changeResult} onSendMail={sendMail} /> : null}
    </div>
  );
}
