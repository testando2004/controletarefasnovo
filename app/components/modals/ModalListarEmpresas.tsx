'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Building, RefreshCw, Edit, Trash2, AlertCircle, FileText, Upload, Calendar, Clock, CheckCircle, AlertTriangle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Empresa, EmpresaDocumento } from '@/app/types';
import ModalCadastrarEmpresa from './ModalCadastrarEmpresa';
import ModalBase from './ModalBase';
import { api } from '@/app/utils/api';

// Badge de validade dos documentos da empresa (usado nos cards da listagem)
function BadgeValidadeDocumentos({ resumo }: { resumo?: { vencido: number; proximoVencer: number } | null }) {
  const vencido = resumo?.vencido || 0;
  const proximoVencer = resumo?.proximoVencer || 0;
  if (vencido === 0 && proximoVencer === 0) return null;

  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {vencido > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
          <XCircle size={10} />
          {vencido} Vencido{vencido > 1 ? 's' : ''}
        </span>
      )}
      {proximoVencer > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
          <AlertTriangle size={10} />
          {proximoVencer} Prox. vencer
        </span>
      )}
    </div>
  );
}

// Componente de Documentos da Empresa
function DocumentosEmpresa({ empresaId }: { empresaId: number }) {
  const [documentos, setDocumentos] = useState<EmpresaDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    tipo: '',
    descricao: '',
    validadeAte: '',
    alertarDiasAntes: 30,
  });

  const carregarDocumentos = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await api.getEmpresaDocumentos(empresaId);
      setDocumentos(docs);
    } catch (e) {
      console.error('Erro ao carregar documentos:', e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarDocumentos();
  }, [carregarDocumentos]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = document.getElementById(`file-upload-${empresaId}`) as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file || !uploadData.tipo) return;

    try {
      setUploading(true);
      await api.uploadEmpresaDocumento(empresaId, file, uploadData.tipo, {
        descricao: uploadData.descricao || undefined,
        validadeAte: uploadData.validadeAte || undefined,
        alertarDiasAntes: uploadData.alertarDiasAntes,
      });
      await carregarDocumentos();
      setShowUploadForm(false);
      setUploadData({ tipo: '', descricao: '', validadeAte: '', alertarDiasAntes: 30 });
      if (fileInput) fileInput.value = '';
    } catch (e) {
      console.error('Erro ao fazer upload:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleExcluir = async (docId: number) => {
    if (!confirm('Excluir este documento?')) return;
    try {
      await api.excluirEmpresaDocumento(empresaId, docId);
      await carregarDocumentos();
    } catch (e) {
      console.error('Erro ao excluir:', e);
    }
  };

  const getBadgeValidade = (doc: EmpresaDocumento) => {
    if (!doc.validadeAte) return null;
    
    const status = doc.validadeStatus || 'sem_validade';
    const dias = doc.validadeDias;

    if (status === 'vencido') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XCircle size={12} />
          Vencido
        </span>
      );
    }
    if (status === 'vence_em_breve') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <AlertTriangle size={12} />
          Vence em {dias} dias
        </span>
      );
    }
    if (status === 'ok') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle size={12} />
          Válido
        </span>
      );
    }
    return null;
  };

  const formatarData = (data?: string | Date | null) => {
    if (!data) return '—';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarTamanho = (bytes: number | string) => {
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <FileText size={18} />
          Documentos da Empresa
        </h4>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 flex items-center gap-1"
        >
          <Upload size={14} />
          Adicionar
        </button>
      </div>

      {/* Form de Upload */}
      {showUploadForm && (
        <form onSubmit={handleUpload} className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Arquivo *</label>
            <input
              id={`file-upload-${empresaId}`}
              type="file"
              required
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
              <select
                value={uploadData.tipo}
                onChange={(e) => setUploadData({ ...uploadData, tipo: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Selecione...</option>
                <option value="Contrato Social">Contrato Social</option>
                <option value="Cartão CNPJ">Cartão CNPJ</option>
                <option value="Alvará">Alvará de Funcionamento</option>
                <option value="Certificado Digital">Certificado Digital</option>
                <option value="Procuração">Procuração</option>
                <option value="Licença Ambiental">Licença Ambiental</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validade (opcional)</label>
              <input
                type="date"
                value={uploadData.validadeAte}
                onChange={(e) => setUploadData({ ...uploadData, validadeAte: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição (opcional)</label>
            <input
              type="text"
              value={uploadData.descricao}
              onChange={(e) => setUploadData({ ...uploadData, descricao: e.target.value })}
              placeholder="Ex: Alvará 2026"
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          {uploadData.validadeAte && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alertar quantos dias antes?</label>
              <input
                type="number"
                min={1}
                value={uploadData.alertarDiasAntes}
                onChange={(e) => setUploadData({ ...uploadData, alertarDiasAntes: Number(e.target.value) })}
                className="w-24 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Enviando...' : 'Enviar'}
            </button>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Documentos */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-orange-500" />
        </div>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          Nenhum documento cadastrado
        </p>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                      {doc.tipo}
                    </span>
                    {getBadgeValidade(doc)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {doc.nome} • {formatarTamanho(doc.tamanho)}
                  </p>
                  {doc.validadeAte && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      Validade: {formatarData(doc.validadeAte)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                  title="Abrir documento"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => handleExcluir(doc.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DetalhesDiretoModalProps {
  empresa: Empresa;
  onClose: () => void;
  onEditar: (empresa: Empresa) => void;
  onExcluir: (empresa: Empresa) => void;
  empresaEmEdicao: Empresa | null;
  setEmpresaEmEdicao: React.Dispatch<React.SetStateAction<Empresa | null>>;
}

function DetalhesDiretoModal({
  empresa,
  onClose,
  onEditar,
  onExcluir,
  empresaEmEdicao,
  setEmpresaEmEdicao,
}: DetalhesDiretoModalProps) {
  const handleClose = () => onClose();
  return (
    <div>
      <ModalBase
        isOpen
        onClose={handleClose}
        labelledBy="detalhes-empresa-title"
        dialogClassName="w-full max-w-4xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto m-4"
        zIndex={1225}
      >
        <div className="rounded-2xl">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 id="detalhes-empresa-title" className="text-xl font-bold text-white">Detalhes da Empresa</h3>
              <button
                onClick={handleClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-4">Informações Principais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                  <p className="text-gray-900 font-semibold">{empresa.razao_social}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <p className="text-gray-900 font-semibold">{empresa.codigo}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <p className="text-gray-900">{empresa.cnpj}</p>
                </div>
                {empresa.apelido && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                    <p className="text-gray-900">{empresa.apelido}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {empresa.inscricao_estadual && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual (IE)</label>
                    <p className="text-gray-900 break-words">{empresa.inscricao_estadual}</p>
                  </div>
                )}
                {empresa.inscricao_municipal && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Municipal (IM)</label>
                    <p className="text-gray-900 break-words">{empresa.inscricao_municipal}</p>
                  </div>
                )}
                {empresa.regime_federal && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regime Federal</label>
                    <p className="text-gray-900">{empresa.regime_federal}</p>
                  </div>
                )}
                {empresa.regime_estadual && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regime Estadual</label>
                    <p className="text-gray-900 break-words">{empresa.regime_estadual}</p>
                  </div>
                )}
                {empresa.regime_municipal && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regime Municipal</label>
                    <p className="text-gray-900 break-words">{empresa.regime_municipal}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-4">Endereço</h4>
              <div className="space-y-2">
                {empresa.logradouro && (
                  <p className="text-gray-900 dark:text-gray-100">
                    {empresa.logradouro}
                    {empresa.numero && `, ${empresa.numero}`}
                  </p>
                )}
                {empresa.bairro && (
                  <p className="text-gray-900 dark:text-gray-100">
                    {empresa.bairro}
                    {empresa.cidade && empresa.estado && (
                      <> - {empresa.cidade}/{empresa.estado}</>
                    )}
                  </p>
                )}
                {empresa.cep && <p className="text-gray-900 dark:text-gray-100">CEP: {empresa.cep}</p>}
              </div>
            </div>

            {/* Documentos da Empresa */}
            <DocumentosEmpresa empresaId={empresa.id} />

            <div className="flex gap-3">
              <button
                onClick={() => onEditar(empresa)}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                Editar
              </button>
              <button
                onClick={() => onExcluir(empresa)}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      </ModalBase>

      {empresaEmEdicao && (
        <ModalCadastrarEmpresa
          empresa={empresaEmEdicao}
          onClose={() => setEmpresaEmEdicao(null)}
        />
      )}
    </div>
  );
}

interface ModalListarEmpresasProps {
  onClose: () => void;
  tipo?: 'cadastradas' | 'nao-cadastradas';
  empresaIdInicial?: number;
}

export default function ModalListarEmpresas({
  onClose,
  tipo = 'cadastradas',
  empresaIdInicial,
}: ModalListarEmpresasProps) {
  const { empresas, excluirEmpresa, mostrarConfirmacao } = useSistema();
  const [buscaEmpresa, setBuscaEmpresa] = useState('');

  const getNomeEmpresa = (empresa: Empresa): string => {
    return (
      (empresa.razao_social && String(empresa.razao_social)) ||
      (empresa.apelido && String(empresa.apelido)) ||
      (empresa.codigo && String(empresa.codigo)) ||
      'Sem Razão Social'
    );
  };

  const temCnpj = (empresa: Empresa): boolean => {
    return String(empresa.cnpj || '').replace(/\D/g, '').length > 0;
  };
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(() => {
    if (empresaIdInicial) {
      const emp = (empresas || []).find((e) => e.id === empresaIdInicial);
      return emp || null;
    }
    return null;
  });
  const [empresaEmEdicao, setEmpresaEmEdicao] = useState<Empresa | null>(null);
  const [autoDetalheConsumido, setAutoDetalheConsumido] = useState(false);
  const detalheDireto = Boolean(empresaIdInicial);

  // Sincronizar empresa selecionada com atualizações feitas no contexto
  React.useEffect(() => {
    if (!empresaSelecionada) return;
    const atualizada = (empresas || []).find((e) => e.id === empresaSelecionada.id);
    if (atualizada && atualizada !== empresaSelecionada) {
      setEmpresaSelecionada(atualizada);
    }
  }, [empresas, empresaSelecionada]);

  React.useEffect(() => {
    if (!empresaIdInicial || autoDetalheConsumido) return;
    const emp = (empresas || []).find((e) => e.id === empresaIdInicial);
    if (emp) {
      setEmpresaSelecionada(emp);
      setAutoDetalheConsumido(true);
    }
  }, [empresaIdInicial, empresas, autoDetalheConsumido]);

  const empresasFiltradas = (empresas || []).filter((empresa) => {
    const busca = (buscaEmpresa || '').toLowerCase();
    const norm = (v?: string | null) => (v || '').toLowerCase();
    const cnpjDigits = String(empresa.cnpj || '').replace(/\D/g, '');
    const temCnpj = cnpjDigits.length > 0;

    const matchBusca =
      norm(empresa.razao_social).includes(busca) ||
      norm(empresa.codigo).includes(busca) ||
      norm(empresa.apelido).includes(busca) ||
      (empresa.cnpj && String(empresa.cnpj).includes(buscaEmpresa));

    // Regra do app: se tem CNPJ preenchido, deve aparecer em "Empresas" (cadastradas)
    // (mesmo que o campo `cadastrada` esteja inconsistente no banco)
    let matchTipo = false;
    if (tipo === 'cadastradas') {
      matchTipo = temCnpj || empresa.cadastrada === true;
    } else {
      matchTipo = !temCnpj && (empresa.cadastrada === false || !empresa.cadastrada);
    }

    return matchBusca && matchTipo;
  });

  const formatarData = (data?: string) => {
    if (!data) return 'Não informada';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const recarregarEmpresas = () => {
    // Implementar lógica de recarregamento
  };

  const handleEditar = (empresa: Empresa) => {
    setEmpresaEmEdicao(empresa);
  };

  const handleExcluir = (empresa: Empresa) => {
    void (async () => {
      const ok = await mostrarConfirmacao({
        titulo: 'Excluir Empresa',
        mensagem: 'Tem certeza que deseja excluir esta empresa?\n\nEssa ação não poderá ser desfeita.',
        tipo: 'perigo',
        textoConfirmar: 'Sim, Excluir',
        textoCancelar: 'Cancelar',
      });

      if (ok) {
        excluirEmpresa(empresa.id);
        if (empresaSelecionada?.id === empresa.id) {
          if (detalheDireto) {
            onClose();
          } else {
            setEmpresaSelecionada(null);
          }
        }
      }
    })();
  };

  // Renderização condicional: quando chamado com empresaIdInicial, mostrar apenas Detalhes direto
  if (detalheDireto) {
    if (!empresaSelecionada) return null;
    return (
      <DetalhesDiretoModal
        empresa={empresaSelecionada}
        onClose={onClose}
        onEditar={handleEditar}
        onExcluir={handleExcluir}
        empresaEmEdicao={empresaEmEdicao}
        setEmpresaEmEdicao={setEmpresaEmEdicao}
      />
    );
  }

  return (
    <>
      {/* Modal Principal */}
      <ModalBase
        isOpen
        onClose={onClose}
        labelledBy="listar-empresas-title"
        dialogClassName="w-full max-w-6xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
        zIndex={1060}
      >
          {/* Header */}
          <div
            className={`bg-gradient-to-r ${
              tipo === 'cadastradas'
                ? 'from-blue-500 to-blue-600'
                : 'from-amber-500 to-orange-600'
            } p-6 rounded-t-2xl sticky top-0 z-10`}
          >
            <div className="flex justify-between items-center">
              <h3 id="listar-empresas-title" className="text-xl font-bold text-white">
                {tipo === 'cadastradas' ? 'Empresas Cadastradas' : 'Empresas Novas'} ({empresasFiltradas.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={recarregarEmpresas}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-colors"
                  title="Recarregar lista"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Busca */}
          <div className="p-6">
            <div className="mb-6">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Buscar por código, CNPJ ou razão social..."
                  value={buscaEmpresa}
                  onChange={(e) => setBuscaEmpresa(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                />
              </div>
            </div>

            {/* Grid de Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empresasFiltradas.map((empresa) => (
                <div
                  key={empresa.id}
                  className="bg-white dark:bg-[var(--card)] rounded-xl p-4 border border-gray-200 dark:border-[var(--border)] hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between h-full"
                  onClick={() => setEmpresaSelecionada(empresa)}
                >
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-bold text-gray-900 dark:text-[var(--fg)] text-sm sm:text-base truncate max-w-[180px] md:max-w-[200px] lg:max-w-[220px] uppercase tracking-wide"
                          title={getNomeEmpresa(empresa)}
                        >
                          {getNomeEmpresa(empresa)}
                        </h4>

                        {empresa.apelido && (
                          <p
                            className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[180px] md:max-w-[200px] lg:max-w-[220px]"
                            title={empresa.apelido}
                          >
                            ({empresa.apelido})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium shadow-sm">
                          {empresa.codigo || '—'}
                        </span>

                        {!temCnpj(empresa) && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                            <AlertCircle size={10} />
                            Nova
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 mb-2">
                      <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                        {empresa.codigo}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <p className="flex items-center gap-2">
                        <span className="text-gray-400">📄</span>
                        <span>{empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : 'CNPJ: não informado'}</span>
                      </p>
                      {empresa.cidade && empresa.estado && (
                        <p className="flex items-center gap-2">
                          <span className="">📍</span>
                          <span>
                            {empresa.cidade}/{empresa.estado}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Badges de validade dos documentos */}
                    <BadgeValidadeDocumentos resumo={(empresa as any).validadeSummary} />
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmpresaSelecionada(empresa);
                      }}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {empresasFiltradas.length === 0 && (
              <div className="text-center py-12">
                <Building size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Nenhuma empresa encontrada</p>
              </div>
            )}
          </div>
      </ModalBase>

      {empresaEmEdicao && (
        <ModalCadastrarEmpresa
          empresa={empresaEmEdicao}
          onClose={() => setEmpresaEmEdicao(null)}
        />
      )}

      {/* Modal de Detalhes */}
      {empresaSelecionada && (
        <ModalBase
          isOpen
          onClose={() => setEmpresaSelecionada(null)}
          labelledBy="detalhes-empresa-in-list-title"
          dialogClassName="w-full max-w-4xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto m-4"
          zIndex={1225}
        >
          <div className="rounded-2xl">
            {/* Header Detalhes */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h3 id="detalhes-empresa-in-list-title" className="text-xl font-bold text-white">Detalhes da Empresa</h3>
                <button
                  onClick={() => setEmpresaSelecionada(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo Detalhes */}
            <div className="p-6 space-y-6">
              {/* Informações Principais */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-4">Informações Principais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razão Social
                    </label>
                    <p className="text-gray-900 font-semibold">
                      {empresaSelecionada.razao_social}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                    <p className="text-gray-900 font-semibold">{empresaSelecionada.codigo}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                    <p className="text-gray-900">{empresaSelecionada.cnpj}</p>
                  </div>
                  {empresaSelecionada.apelido && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Fantasia
                      </label>
                      <p className="text-gray-900">{empresaSelecionada.apelido}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Abertura
                    </label>
                    <p className="text-gray-900">
                      {formatarData(empresaSelecionada.data_abertura)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Inscrições e Regimes */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {empresaSelecionada.inscricao_estadual && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inscrição Estadual (IE)
                      </label>
                      <p className="text-gray-900 break-words">
                        {empresaSelecionada.inscricao_estadual}
                      </p>
                    </div>
                  )}
                  {empresaSelecionada.inscricao_municipal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inscrição Municipal (IM)
                      </label>
                      <p className="text-gray-900 break-words">
                        {empresaSelecionada.inscricao_municipal}
                      </p>
                    </div>
                  )}
                  {empresaSelecionada.regime_federal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Regime Federal
                      </label>
                      <p className="text-gray-900">{empresaSelecionada.regime_federal}</p>
                    </div>
                  )}
                  {empresaSelecionada.regime_estadual && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Regime Estadual
                      </label>
                      <p className="text-gray-900 break-words">
                        {empresaSelecionada.regime_estadual}
                      </p>
                    </div>
                  )}
                  {empresaSelecionada.regime_municipal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Regime Municipal
                      </label>
                      <p className="text-gray-900 break-words">
                        {empresaSelecionada.regime_municipal}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-4">Endereço</h4>
                <div className="space-y-2">
                  {empresaSelecionada.logradouro && (
                    <p className="text-gray-900 dark:text-gray-100">
                      {empresaSelecionada.logradouro}
                      {empresaSelecionada.numero && `, ${empresaSelecionada.numero}`}
                    </p>
                  )}
                  {empresaSelecionada.bairro && (
                    <p className="text-gray-900 dark:text-gray-100">
                      {empresaSelecionada.bairro}
                      {empresaSelecionada.cidade && empresaSelecionada.estado && (
                        <> - {empresaSelecionada.cidade}/{empresaSelecionada.estado}</>
                      )}
                    </p>
                  )}
                  {empresaSelecionada.cep && (
                    <p className="text-gray-900 dark:text-gray-100">CEP: {empresaSelecionada.cep}</p>
                  )}
                </div>
              </div>

              {/* Documentos da Empresa */}
              <DocumentosEmpresa empresaId={empresaSelecionada.id} />

              {/* Botões de Ação (Admin) */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleEditar(empresaSelecionada)}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleExcluir(empresaSelecionada)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </ModalBase>
      )}
    </>
  );
}