"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ExternalLink, Download, FileText } from 'lucide-react';
import { formatarDataHora, formatarTamanhoParcela } from '@/app/utils/helpers';
import ModalBase from './ModalBase';

interface ModalPreviewDocumentoProps {
  documento: {
    id: number;
    nome: string;
    url: string;
    tipo?: string;
    tamanho?: number;
    dataUpload?: string | Date;
  };
  onClose: () => void;
}

export default function ModalPreviewDocumento({ documento, onClose }: ModalPreviewDocumentoProps) {
  const isImage = (documento?.tipo || '').startsWith('image/');
  const isPdf = documento?.tipo === 'application/pdf' || documento?.nome?.toLowerCase()?.endsWith('.pdf');
  const [urlAvailable, setUrlAvailable] = useState<boolean | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setUrlAvailable(null);
    setUrlError(null);
    setResolvedUrl(null);

    const check = async () => {
      // Sempre buscar signed URL via API — nunca usar URL armazenada (segurança)
      if (!documento?.id) {
        if (mounted) {
          setUrlAvailable(false);
          setUrlError('Documento sem ID');
        }
        return;
      }

      let urlToCheck: string | null = null;
      try {
        const resp = await fetch(`/api/documentos/${documento.id}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (resp.ok) {
          const data = await resp.json().catch(() => null);
          urlToCheck = data?.url ?? null;
          if (urlToCheck && mounted) setResolvedUrl(urlToCheck);
        } else {
          const body = await resp.json().catch(() => ({} as any));
          if (mounted) {
            setUrlAvailable(false);
            setUrlError(body?.error || `Recurso indisponível (status ${resp.status})`);
          }
          return;
        }
      } catch (e: any) {
        if (mounted) {
          setUrlAvailable(false);
          setUrlError('Erro ao recuperar URL do documento');
        }
        return;
      }

      if (!urlToCheck) {
        if (mounted) {
          setUrlAvailable(false);
          setUrlError('URL do documento ausente');
        }
        return;
      }

      try {
        // Tenta um HEAD para checar existência; caso o servidor não permita HEAD, tenta GET com modo 'no-cors' falhando graciosamente
        const resp = await fetch(urlToCheck, { method: 'HEAD' });
        if (!mounted) return;
        if (resp.ok) {
          setUrlAvailable(true);
        } else {
          let msg = `Recurso indisponível (status ${resp.status})`;
          try {
            const body = await resp.json().catch(() => null);
            if (body && (body.message || body.error)) msg = body.message || body.error || msg;
          } catch {}
          setUrlAvailable(false);
          setUrlError(msg);
        }
      } catch (err: any) {
        if (!mounted) return;
        // Falhas de CORS ou rede: permitimos abrir em nova aba, mas avisamos que não foi possível verificar
        setUrlAvailable(false);
        setUrlError('Não foi possível verificar o arquivo (CORS/erro de rede). Abra em nova aba para confirmar.');
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [documento?.id]);

  const abrirNovaAba = () => {
    try {
      window.open(resolvedUrl || '', '_blank', 'noopener,noreferrer');
    } catch {}
  };

  const baixar = () => {
    try {
      const a = document.createElement('a');
      a.href = resolvedUrl || documento.url;
      a.download = documento.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  };

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="preview-title" dialogClassName="w-full max-w-5xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-hidden" zIndex={10050}>
      <div className="rounded-2xl">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 id="preview-title" className="text-xl font-bold text-white">Visualização do Documento</h3>
            <p className="text-white/90 text-sm truncate max-w-[70vw]">{documento?.nome}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirNovaAba} className="text-white bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg flex items-center gap-2">
              <ExternalLink size={16} /> Abrir em outra aba
            </button>
            <button onClick={baixar} className="text-white bg-white/20 hover:bg-white/30 p-2 rounded-lg">
              <Download size={18} />
            </button>
            <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 h-[calc(90vh-112px)]">
          <div className="md:col-span-3 h-full bg-gray-50 dark:bg-[var(--muted)] flex items-center justify-center overflow-auto">
            {urlAvailable === null && (
              <div className="text-center text-gray-500 dark:text-gray-300 p-8">Verificando disponibilidade...</div>
            )}

            {urlAvailable === false && (
              <div className="text-center text-gray-500 dark:text-gray-300 p-8">
                <FileText size={48} className="mx-auto mb-3 opacity-40" />
                <p className="mb-2">Arquivo não disponível: {urlError ?? 'Não encontrado'}</p>
                <div className="flex justify-center gap-2">
                  <button onClick={abrirNovaAba} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Abrir em outra aba</button>
                  <button onClick={baixar} className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg">Baixar</button>
                </div>
              </div>
            )}

            {urlAvailable === true && (
              <>
                {isImage && (
                  <Image
                    src={resolvedUrl || documento.url}
                    alt={documento.nome}
                    width={1600}
                    height={1200}
                    unoptimized
                    className="max-w-full max-h-full object-contain"
                    onError={() => { setUrlAvailable(false); setUrlError('Falha ao carregar imagem'); }}
                  />
                )}
                {isPdf && (
                  <iframe src={resolvedUrl || documento.url} className="w-full h-full" title="Pré-visualização PDF" />
                )}
                {!isImage && !isPdf && (
                  <div className="text-center text-gray-500 dark:text-gray-300 p-8">
                    <FileText size={48} className="mx-auto mb-3 opacity-40" />
                    <p>Pré-visualização não disponível para este tipo de arquivo.</p>
                    <button onClick={abrirNovaAba} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Abrir em outra aba</button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="md:col-span-1 border-l border-gray-200 dark:border-[var(--border)] p-4 space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Detalhes</h4>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <div className="flex justify-between"><span>Nome</span><span className="ml-2 truncate max-w-[10rem]" title={documento.nome}>{documento.nome}</span></div>
              {documento.tamanho !== undefined && (
                <div className="flex justify-between"><span>Tamanho</span><span>{formatarTamanhoParcela(Number(documento.tamanho))}</span></div>
              )}
              {documento.tipo && (
                <div className="flex justify-between"><span>Tipo</span><span>{documento.tipo}</span></div>
              )}
              {documento.dataUpload && (
                <div className="flex justify-between"><span>Enviado</span><span>{formatarDataHora(documento.dataUpload)}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
