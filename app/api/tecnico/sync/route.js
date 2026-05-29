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

export async function POST(request) {
  let syncJob = null;

  try {
    const payload = await request.json();
    const clientMutationId = payload.clientMutationId;

    if (!clientMutationId) {
      return NextResponse.json({ error: 'clientMutationId requerido.' }, { status: 400 });
    }

    const existing = (await listVisitas()).find((visita) => visita.clientMutationId === clientMutationId);
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
        prefix: `firmas/tecnicos/${payload.tecnicoId || 'sin-tecnico'}`,
        tipo: 'firma',
      });
    }

    const selfieUpload = payload.selfieDataUrl
      ? await uploadDataUrl({
        dataUrl: payload.selfieDataUrl,
        filename: `selfie-${clientMutationId}.jpg`,
        prefix: `servicios/${clientMutationId}/selfie`,
        tipo: 'selfie_firma',
      })
      : null;

    const evidenceUploads = [];
    for (const attachment of payload.attachments || []) {
      if (!attachment.dataUrl) continue;
      const uploaded = await uploadDataUrl({
        dataUrl: attachment.dataUrl,
        filename: attachment.name,
        prefix: `servicios/${clientMutationId}/evidencias`,
        tipo: attachment.tipo || 'evidencia',
      });
      evidenceUploads.push({ source: attachment, uploaded });
    }

    if (payload.tecnicoId && (payload.firmaTexto || firmaUpload)) {
      await updateEntity('tecnicos', payload.tecnicoId, {
        firmaTexto: payload.firmaTexto || '',
        firmaImagenUrl: firmaUpload?.publicUrl || payload.firmaImagenUrl || '',
        firmaImagenR2Key: firmaUpload?.key || '',
        firmaUpdatedAt: new Date().toISOString(),
      });
    }

    const visita = await createEntity('visitas', {
      clienteId: Number(payload.clienteId),
      equipoIds: (payload.equipoIds || []).map((id) => Number(id)),
      equipoId: payload.equipoIds?.length ? Number(payload.equipoIds[0]) : null,
      tecnicoId: Number(payload.tecnicoId),
      vendedorId: payload.vendedorId ? Number(payload.vendedorId) : null,
      servicioId: Number(payload.servicioId),
      fecha: payload.fecha || new Date().toISOString(),
      descripcion: payload.descripcion || '',
      notasTecnicas: payload.descripcion || '',
      estado: 'completada',
      offlineEstado: 'SINCRONIZADO',
      clientMutationId,
      signedAt: payload.signedAt || new Date().toISOString(),
      fechaCierre: payload.signedAt || new Date().toISOString(),
      firmaTecnicoTexto: payload.firmaTexto || '',
      firmaTecnicoImagenUrl: firmaUpload?.publicUrl || '',
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
        publicUrl: item.uploaded.publicUrl,
        checksumSha256: item.uploaded.checksumSha256,
        metadata: { clientMutationId },
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
        publicUrl: firmaUpload.publicUrl,
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
        publicUrl: selfieUpload.publicUrl,
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
