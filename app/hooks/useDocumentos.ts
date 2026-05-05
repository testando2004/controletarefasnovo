import { useCallback, useContext, useState } from 'react';
import { api } from '../utils/api';
import { SistemaContext } from '../context/SistemaContext';

interface Documento {
  id: number;
  nome: string;
  tamanho: number;
  tipo: string;
  url: string;
  dataCriacao: string;
  processoId: number;
  departamentoId?: number;
  perguntaId?: number;
  usuarioCriacao: string;
}

export const useDocumentos = () => {
  const context = useContext(SistemaContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!context) {
    throw new Error('useDocumentos deve ser usado dentro de SistemaProvider');
  }

  const carregarDocumentos = useCallback(async (processoId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocumentos(processoId);
      setDocumentos(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar documentos');
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocumento = useCallback(
    async (
      processoId: number,
      arquivo: File,
      tipo: string,
      perguntaId?: number,
      departamentoId?: number
    ) => {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      try {
        // Simular progresso do upload
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 100);

        const documento = await api.uploadDocumento(processoId, arquivo, tipo, perguntaId, departamentoId);
        
        clearInterval(progressInterval);
        setUploadProgress(100);

        setTimeout(() => setUploadProgress(0), 500);

        setDocumentos(prev => [...prev, documento]);
        return documento;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const excluirDocumento = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.excluirDocumento(id);
      setDocumentos(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir documento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const baixarDocumento = useCallback((documento: Documento) => {
    const doDownload = async () => {
      try {
        // Sempre buscar signed URL via API — nunca usar URL direta
        const resp = await fetch(`/api/documentos/${documento.id}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!resp.ok) throw new Error('Sem permissão ou documento indisponível');
        const data = await resp.json().catch(() => ({} as any));
        const url = data?.url;
        if (!url) throw new Error('URL do documento indisponível');
        const link = document.createElement('a');
        link.href = url;
        link.download = documento.nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao baixar documento');
      }
    };
    void doDownload();
  }, []);

  const previewDocumento = useCallback((_documento: Documento): string | null => {
    // URLs publicas nao existem mais — preview deve buscar signed URL via API
    // Retorna null para que o componente de preview busque via /api/documentos/:id
    return null;
  }, []);

  const filtrarDocumentosPorDepartamento = useCallback(
    (departamentoId?: number) => {
      if (!departamentoId) return documentos;
      return documentos.filter(d => d.departamentoId === departamentoId);
    },
    [documentos]
  );

  const filtrarDocumentosPorPergunta = useCallback(
    (perguntaId?: number) => {
      if (!perguntaId) return documentos;
      return documentos.filter(d => d.perguntaId === perguntaId);
    },
    [documentos]
  );

  const obterEstatisticasDocumentos = useCallback(() => {
    return {
      total: documentos.length,
      tamanhoTotal: documentos.reduce((acc, d) => acc + d.tamanho, 0),
      porTipo: documentos.reduce((acc, d) => {
        const tipo = d.tipo.split('/')[1] || 'desconhecido';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    };
  }, [documentos]);

  return {
    documentos,
    loading,
    error,
    uploadProgress,
    carregarDocumentos,
    uploadDocumento,
    excluirDocumento,
    baixarDocumento,
    previewDocumento,
    filtrarDocumentosPorDepartamento,
    filtrarDocumentosPorPergunta,
    obterEstatisticasDocumentos
  };
};
