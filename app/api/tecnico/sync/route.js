import { NextResponse } from 'next/server';
import { createEntity, listVisitas, updateEntity } from '../../../lib/supabase-store';
import { buildR2Key, dataUrlToBuffer, uploadBufferToR2 } from '../../../lib/r2';

export const runtime = 'nodejs';

function getExtension(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'application/pdf') return '.pdf';
  return '.jpg';
}

async function uploadDataUrl({ dataUrl, filename, prefix, tipo }) {
  const { buffer, mimeType } = dataUrlToBuffer(dataUrl);
  const key = buildR2Key({
    prefix,
    filename: filename || `${tipo}${getExtension(mimeType)}`,
    extension: getExtension(mimeType),
  });

  const result = await uploadBufferToR2({ buffer, key, contentType: mimeType });

  return {
    ...result,
    mimeType,
    sizeBytes: buffer.length,
  };
}

function buildTechnicalReportData(payload) {
  const mediciones = Array.isArray(payload.mediciones)
    ? payload.mediciones
      .filter((measurement) => ['variable', 'programado', 'observado', 'diferencia', 'criterio']
        .some((field) => String(measurement?.[field] || '').trim()))
      .map((measurement) => ({
        variable: String(measurement.variable || '').trim(),
        unidad: String(measurement.unidad || '').trim(),
        programado: String(measurement.programado || '').trim(),
        observado: String(measurement.observado || '').trim(),
        referencia: String(measurement.referencia || '').trim(),
        diferenciaModo: String(measurement.diferenciaModo || '').trim(),
        diferencia: String(measurement.diferencia || '').trim(),
        criterioModo: String(measurement.criterioModo || '').trim(),
        criterioUnidad: String(measurement.criterioUnidad || '').trim(),
        criterioMenos: String(measurement.criterioMenos || '').trim(),
        criterioMas: String(measurement.criterioMas || '').trim(),
        criterioMin: String(measurement.criterioMin || '').trim(),
        criterioMax: String(measurement.criterioMax || '').trim(),
        cumple: String(measurement.cumple || '').trim() || 'Si',
        criterio: String(measurement.criterio || '').trim(),
      }))
    : [];

  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist.map((item) => ({
      label: String(item.label || '').trim(),
      checked: Boolean(item.checked),
    })).filter((item) => item.label)
    : [];

  return {
    schema: 'cmcing_technical_report',
    version: 2,
    objetivo: String(payload.objetivo || '').trim(),
    especificaciones: String(payload.especificaciones || '').trim(),
    trabajoRealizado: String(payload.trabajoRealizado || payload.descripcion || '').trim(),
    checklist,
    mediciones,
    certificadoInstrumentos: String(payload.certificadoInstrumentos || '').trim(),
    codigoInstrumento: String(payload.codigoInstrumento || '').trim(),
    codigoServicio: String(payload.codigoServicio || '').trim(),
    atencion: String(payload.atencion || '').trim(),
  };
}

export async function POST(request) {
  let syncJob = null;

  try {
    const payload = await request.json();
    const clientMutationId = payload.clientMutationId;
    const technicalReport = buildTechnicalReportData(payload);

    if (!clientMutationId) {
      return NextResponse.json({ error: 'clientMutationId requerido.' }, { status: 400 });
    }

    const existing = (await listVisitas())
      .find((visita) => (visita.clientMutationId || visita.clienteMutationId) === clientMutationId);
    if (existing) {
      return NextResponse.json({ status: 'duplicate', visita: existing });
    }

    syncJob = await createEntity('syncJobs', {
      clientMutationId,
      tecnicoId: payload.tecnicoId ? Number(payload.tecnicoId) : null,
      entidad: 'visita',
      accion: 'create_offline',
      estado: 'SUBIENDO',
      payload,
      attempts: 1,
      queuedAt: payload.createdAt || new Date().toISOString(),
    });

    let firmaUpload = null;
    if (payload.firmaImagenDataUrl) {
      firmaUpload = await uploadDataUrl({
        dataUrl: payload.firmaImagenDataUrl,
        filename: `firma-tecnico-${payload.tecnicoId || 'sin-tecnico'}.png`,
        prefix: `private/firmas/tecnicos/${payload.tecnicoId || 'sin-tecnico'}`,
        tipo: 'firma',
      });
    }

    const selfieUpload = payload.selfieDataUrl
      ? await uploadDataUrl({
        dataUrl: payload.selfieDataUrl,
        filename: `selfie-${clientMutationId}.jpg`,
        prefix: `private/servicios/${clientMutationId}/selfie`,
        tipo: 'selfie_firma',
      })
      : null;

    const evidenceUploads = [];
    for (const attachment of payload.attachments || []) {
      if (!attachment.dataUrl) continue;
      const attachmentType = attachment.tipo || 'evidencia';
      const uploaded = await uploadDataUrl({
        dataUrl: attachment.dataUrl,
        filename: attachment.name,
        prefix: `private/servicios/${clientMutationId}/${attachmentType === 'certificado_instrumento' ? 'certificados' : attachmentType === 'imagen_adjunta' ? 'imagenes' : 'evidencias'}`,
        tipo: attachmentType,
      });
      evidenceUploads.push({ source: attachment, uploaded });
    }

    if (payload.tecnicoId && (payload.firmaTexto || firmaUpload)) {
      await updateEntity('tecnicos', payload.tecnicoId, {
        firmaTexto: payload.firmaTexto || '',
        firmaImagenUrl: firmaUpload?.privateUrl || payload.firmaImagenUrl || '',
        firmaImagenR2Key: firmaUpload?.key || '',
        firmaUpdatedAt: new Date().toISOString(),
      });
    }

    const visita = await createEntity('visitas', {
      codigo: technicalReport.codigoServicio || null,
      clienteId: Number(payload.clienteId),
      equipoIds: (payload.equipoIds || []).map((id) => Number(id)),
      equipoId: payload.equipoIds?.length ? Number(payload.equipoIds[0]) : null,
      tecnicoId: Number(payload.tecnicoId),
      vendedorId: payload.vendedorId ? Number(payload.vendedorId) : null,
      servicioId: Number(payload.servicioId),
      fecha: payload.fecha || new Date().toISOString(),
      descripcion: technicalReport.trabajoRealizado,
      notasTecnicas: JSON.stringify(technicalReport),
      estado: 'completada',
      offlineEstado: 'SINCRONIZADO',
      clienteMutationId: clientMutationId,
      clientMutationId,
      signedAt: payload.signedAt || new Date().toISOString(),
      fechaCierre: payload.signedAt || new Date().toISOString(),
      firmaTecnicoTexto: payload.firmaTexto || '',
      firmaTecnicoImagenUrl: firmaUpload?.privateUrl || '',
    });

    const createdAttachments = [];
    for (const item of evidenceUploads) {
      createdAttachments.push(await createEntity('adjuntos', {
        visitaId: visita.id,
        tecnicoId: payload.tecnicoId ? Number(payload.tecnicoId) : null,
        syncJobId: syncJob.id,
        tipo: item.source.tipo || 'evidencia',
        nombreOriginal: item.source.name || 'evidencia',
        mimeType: item.uploaded.mimeType,
        sizeBytes: item.uploaded.sizeBytes,
        r2Bucket: item.uploaded.bucket,
        r2Key: item.uploaded.key,
        publicUrl: null,
        checksumSha256: item.uploaded.checksumSha256,
        metadata: {
          clientMutationId,
          titulo: item.source.titulo || '',
          descripcion: item.source.descripcion || '',
        },
      }));
    }

    if (firmaUpload) {
      createdAttachments.push(await createEntity('adjuntos', {
        visitaId: visita.id,
        tecnicoId: payload.tecnicoId ? Number(payload.tecnicoId) : null,
        syncJobId: syncJob.id,
        tipo: 'firma_tecnico',
        nombreOriginal: 'firma-tecnico.png',
        mimeType: firmaUpload.mimeType,
        sizeBytes: firmaUpload.sizeBytes,
        r2Bucket: firmaUpload.bucket,
        r2Key: firmaUpload.key,
        publicUrl: null,
        checksumSha256: firmaUpload.checksumSha256,
        metadata: { clientMutationId },
      }));
    }

    if (selfieUpload) {
      const selfie = await createEntity('adjuntos', {
        visitaId: visita.id,
        tecnicoId: payload.tecnicoId ? Number(payload.tecnicoId) : null,
        syncJobId: syncJob.id,
        tipo: 'selfie_firma',
        nombreOriginal: 'selfie-firma.jpg',
        mimeType: selfieUpload.mimeType,
        sizeBytes: selfieUpload.sizeBytes,
        r2Bucket: selfieUpload.bucket,
        r2Key: selfieUpload.key,
        publicUrl: null,
        checksumSha256: selfieUpload.checksumSha256,
        metadata: { clientMutationId },
      });
      createdAttachments.push(selfie);
      await updateEntity('visitas', visita.id, { selfieAdjuntoId: selfie.id });
    }

    const completedJob = await updateEntity('syncJobs', syncJob.id, {
      estado: 'SINCRONIZADO',
      visitaId: visita.id,
      syncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'synced',
      visita: { ...visita, adjuntos: createdAttachments },
      syncJob: completedJob,
    });
  } catch (error) {
    if (syncJob?.id) {
      await updateEntity('syncJobs', syncJob.id, {
        estado: 'ERROR',
        error: error.message,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
