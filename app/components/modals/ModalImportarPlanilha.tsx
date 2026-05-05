'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Download, Eye, Loader2, HelpCircle } from 'lucide-react';
import ModalBase from './ModalBase';
import { api } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';

interface EmpresaCSV {
  codigo?: string;
  razao_social?: string;
  cnpj?: string;
  apelido?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_federal?: string;
  regime_estadual?: string;
  regime_municipal?: string;
  data_abertura?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  cep?: string;
  email?: string;
  telefone?: string;
  cadastrada?: boolean;
}

interface ErroLinha {
  linha: number;
  campo: string;
  mensagem: string;
}

interface ModalImportarPlanilhaProps {
  onClose: () => void;
  onSuccess?: () => void;
}

// Mapeamento flexível de cabeçalhos CSV → campos internos
const MAPEAMENTO_CABECALHOS: Record<string, string> = {
  // código
  'codigo': 'codigo', 'cod': 'codigo', 'code': 'codigo', 'código': 'codigo', 'cod.': 'codigo',
  // razão social
  'razao_social': 'razao_social', 'razao social': 'razao_social', 'razãosocial': 'razao_social',
  'razão social': 'razao_social', 'nome': 'razao_social', 'empresa': 'razao_social',
  'nome empresa': 'razao_social', 'nome_empresa': 'razao_social', 'razão': 'razao_social',
  // cnpj
  'cnpj': 'cnpj', 'cnpj/cpf': 'cnpj', 'documento': 'cnpj', 'cpf/cnpj': 'cnpj',
  // apelido
  'apelido': 'apelido', 'fantasia': 'apelido', 'nome fantasia': 'apelido',
  // inscrições
  'inscricao_estadual': 'inscricao_estadual', 'inscricao estadual': 'inscricao_estadual',
  'inscrição estadual': 'inscricao_estadual', 'ie': 'inscricao_estadual',
  'inscricao_municipal': 'inscricao_municipal', 'inscricao municipal': 'inscricao_municipal',
  'inscrição municipal': 'inscricao_municipal', 'im': 'inscricao_municipal',
  // regimes
  'regime_federal': 'regime_federal', 'regime federal': 'regime_federal',
  'regime_estadual': 'regime_estadual', 'regime estadual': 'regime_estadual',
  'regime_municipal': 'regime_municipal', 'regime municipal': 'regime_municipal',
  // endereço
  'estado': 'estado', 'uf': 'estado',
  'cidade': 'cidade', 'municipio': 'cidade', 'município': 'cidade',
  'bairro': 'bairro',
  'logradouro': 'logradouro', 'endereco': 'logradouro', 'endereço': 'logradouro', 'rua': 'logradouro',
  'numero': 'numero', 'número': 'numero', 'num': 'numero', 'nº': 'numero',
  'cep': 'cep',
  // contato
  'email': 'email', 'e-mail': 'email',
  'telefone': 'telefone', 'tel': 'telefone', 'fone': 'telefone', 'celular': 'telefone',
  // abertura
  'data_abertura': 'data_abertura', 'data abertura': 'data_abertura', 'abertura': 'data_abertura',
  'data de abertura': 'data_abertura',
  // cadastrada
  'cadastrada': 'cadastrada', 'ativa': 'cadastrada',
};

function parseCSVLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Aspas duplas escapadas ("") → literal "
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // Fim do campo entre aspas
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === separator) {
        cells.push(current.trim());
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = parseCSVLine(lines[0], separator).map(h => h.replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map(line => parseCSVLine(line, separator));
  return { headers, rows };
}

// Cabeçalhos que devem ser ignorados automaticamente
const CABECALHOS_IGNORADOS = new Set(['id', 'ativo/inativo', 'ativo', 'inativo', 'status', 'ccm', 'administrativo', 'cadastro', 'contabil', 'contábil', 'fiscal', 'pessoal', 'declaracoes', 'declarações', 'financeiro', 'parcelamentos', 'treinamento', 'teste', 'solicitacao']);

function mapearCabecalho(header: string): string | null {
  const norm = header.toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
  // Ignora cabeçalhos conhecidos que não são campos úteis
  if (CABECALHOS_IGNORADOS.has(norm)) return null;
  // Ignora se contém palavras de colunas do Gestta que não são úteis
  for (const ignorado of CABECALHOS_IGNORADOS) {
    if (norm.includes(ignorado)) return null;
  }
  // Tenta match exato primeiro
  if (MAPEAMENTO_CABECALHOS[norm]) return MAPEAMENTO_CABECALHOS[norm];
  // Tenta match parcial (só para strings com 3+ caracteres para evitar falsos positivos)
  if (norm.length >= 3) {
    for (const [chave, campo] of Object.entries(MAPEAMENTO_CABECALHOS)) {
      if (norm.includes(chave) || (chave.length >= 3 && chave.includes(norm))) return campo;
    }
  }
  return null;
}

export default function ModalImportarPlanilha({ onClose, onSuccess }: ModalImportarPlanilhaProps) {
  const { mostrarAlerta, carregarEmpresas, empresas: empresasExistentes } = useSistema();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<'upload' | 'preview' | 'importando' | 'resultado'>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaCSV[]>([]);
  const [cabecalhosOriginais, setCabecalhosOriginais] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<ErroLinha[]>([]);
  const [resultado, setResultado] = useState<{ criadas: number; duplicadas: number; erros: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [apenasNovas, setApenasNovas] = useState(true);

  const normalizarCnpj = (v?: string) => (v || '').replace(/\D/g, '');
  const normalizarCodigo = (v?: string) => (v || '').trim().toLowerCase();

  const setsExistentes = React.useMemo(() => {
    const cnpjs = new Set<string>();
    const codigos = new Set<string>();
    for (const e of empresasExistentes || []) {
      const cnpj = normalizarCnpj(e.cnpj);
      if (cnpj) cnpjs.add(cnpj);
      const cod = normalizarCodigo(e.codigo);
      if (cod) codigos.add(cod);
    }
    return { cnpjs, codigos };
  }, [empresasExistentes]);

  const empresasComStatus = React.useMemo(() => {
    return empresas.map((emp) => {
      const cnpjN = normalizarCnpj(emp.cnpj);
      const codN = normalizarCodigo(emp.codigo);
      const jaCadastrada = (cnpjN && setsExistentes.cnpjs.has(cnpjN)) || (codN && setsExistentes.codigos.has(codN));
      return { ...emp, jaCadastrada: !!jaCadastrada } as EmpresaCSV & { jaCadastrada: boolean };
    });
  }, [empresas, setsExistentes]);

  const totalDuplicadas = empresasComStatus.filter((e) => e.jaCadastrada).length;
  const totalNovas = empresasComStatus.length - totalDuplicadas;

  const camposDisponiveis = [
    { value: '', label: '— Ignorar —' },
    { value: 'codigo', label: 'Código' },
    { value: 'razao_social', label: 'Razão Social *' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'apelido', label: 'Apelido / Nome Fantasia' },
    { value: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { value: 'inscricao_municipal', label: 'Inscrição Municipal' },
    { value: 'regime_federal', label: 'Regime Federal' },
    { value: 'regime_estadual', label: 'Regime Estadual' },
    { value: 'regime_municipal', label: 'Regime Municipal' },
    { value: 'data_abertura', label: 'Data Abertura' },
    { value: 'estado', label: 'Estado / UF' },
    { value: 'cidade', label: 'Cidade' },
    { value: 'bairro', label: 'Bairro' },
    { value: 'logradouro', label: 'Logradouro / Endereço' },
    { value: 'numero', label: 'Número' },
    { value: 'cep', label: 'CEP' },
    { value: 'email', label: 'Email' },
    { value: 'telefone', label: 'Telefone' },
  ];

  const processarArquivo = useCallback((file: File) => {
    setArquivo(file);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);
        setCabecalhosOriginais(headers);

        // Auto-mapeamento
        const autoMap: Record<string, string> = {};
        headers.forEach(h => {
          const campo = mapearCabecalho(h);
          if (campo) autoMap[h] = campo;
        });
        setMapeamento(autoMap);

        // Converter linhas em objetos usando auto-map
        const empresasParsed: EmpresaCSV[] = rows.map(row => {
          const obj: any = {};
          headers.forEach((h, i) => {
            const campo = autoMap[h];
            if (campo && row[i]) {
              obj[campo] = row[i].replace(/^["']|["']$/g, '');
            }
          });
          return obj as EmpresaCSV;
        }).filter(emp => emp.razao_social || emp.codigo || emp.cnpj);

        setEmpresas(empresasParsed);
        setEtapa('preview');

        // Validação básica
        const errosValidacao: ErroLinha[] = [];
        empresasParsed.forEach((emp, idx) => {
          if (!emp.razao_social && !emp.codigo) {
            errosValidacao.push({ linha: idx + 2, campo: 'razao_social', mensagem: 'Nome/Razão Social ou Código obrigatório' });
          }
        });
        setErros(errosValidacao);
      } catch {
        void mostrarAlerta?.('Erro', 'Não foi possível ler o arquivo. Verifique o formato.', 'erro');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [mostrarAlerta]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      processarArquivo(file);
    } else {
      void mostrarAlerta?.('Atenção', 'Envie um arquivo .csv ou .txt', 'aviso');
    }
  }, [processarArquivo, mostrarAlerta]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processarArquivo(file);
  };

  const atualizarMapeamento = (cabecalhoOriginal: string, campoDestino: string) => {
    const novoMap = { ...mapeamento };
    if (campoDestino === '') {
      delete novoMap[cabecalhoOriginal];
    } else {
      novoMap[cabecalhoOriginal] = campoDestino;
    }
    setMapeamento(novoMap);
  };

  const handleImportar = async () => {
    const aImportar = apenasNovas
      ? empresasComStatus.filter((e) => !e.jaCadastrada).map(({ jaCadastrada: _ja, ...rest }) => rest as EmpresaCSV)
      : empresas;

    if (aImportar.length === 0) {
      void mostrarAlerta?.('Atenção', 'Nenhuma empresa nova para importar. Todas já estão cadastradas.', 'aviso');
      return;
    }

    setEtapa('importando');
    setLoading(true);

    try {
      const res = await api.importarEmpresas(aImportar);
      setResultado(res);
      setEtapa('resultado');

      // Recarregar lista de empresas
      if (typeof carregarEmpresas === 'function') {
        await carregarEmpresas();
      }

      await api.registrarLog?.({
        acao: 'IMPORTAR',
        entidade: 'EMPRESA',
        detalhes: `Importação CSV: ${res.criadas} criadas, ${res.duplicadas} duplicadas, ${res.erros} erros`,
      });
    } catch (error) {
      void mostrarAlerta?.('Erro', 'Falha ao importar empresas. Tente novamente.', 'erro');
      setEtapa('preview');
    } finally {
      setLoading(false);
    }
  };

  const baixarModeloCSV = () => {
    const cabecalhos = 'codigo;razao_social;cnpj;apelido;email;telefone;estado;cidade;bairro;logradouro;numero;cep;inscricao_estadual;regime_federal';
    const exemplo = '001;Empresa Exemplo LTDA;12345678000100;Exemplo;contato@exemplo.com;11999999999;SP;São Paulo;Centro;Rua Principal;100;01001000;123456789;Simples Nacional';
    const csv = `${cabecalhos}\n${exemplo}`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_empresas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="importar-planilha-title" dialogClassName="w-full max-w-5xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto" zIndex={1100}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="importar-planilha-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Importar Empresas via Planilha</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ETAPA 1: Upload */}
        {etapa === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Formatos aceitos:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Arquivo <strong>.csv</strong> separado por <strong>;</strong> ou <strong>,</strong></li>
                  <li>Codificação UTF-8 (padrão do Excel &quot;Salvar como CSV UTF-8&quot;)</li>
                  <li>Primeira linha deve conter os cabeçalhos</li>
                  <li>O sistema reconhece automaticamente colunas comuns (CNPJ, Razão Social, etc.)</li>
                </ul>
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
                ${dragOver
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
                Arraste seu arquivo CSV aqui
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ou clique para selecionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

          
          </div>
        )}

        {/* ETAPA 2: Preview / Mapeamento */}
        {etapa === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                <Eye className="w-5 h-5 inline mr-2" />
                Pré-visualização ({empresas.length} empresas encontradas)
              </h3>
              <button
                onClick={() => { setEtapa('upload'); setArquivo(null); setEmpresas([]); }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Escolher outro arquivo
              </button>
            </div>

            {/* Resumo de duplicados */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{empresas.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total na planilha</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalNovas}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Novas (serão criadas)</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalDuplicadas}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Já cadastradas</p>
              </div>
            </div>

            {/* Toggle: importar só as novas */}
            {totalDuplicadas > 0 && (
              <label className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasNovas}
                  onChange={(e) => setApenasNovas(e.target.checked)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-cyan-900 dark:text-cyan-200">
                    Importar apenas empresas novas (recomendado)
                  </p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400">
                    {apenasNovas
                      ? `Serão importadas ${totalNovas} empresas. As ${totalDuplicadas} já cadastradas serão ignoradas.`
                      : `Todas as ${empresas.length} empresas serão enviadas (as duplicadas serão tratadas pelo servidor).`}
                  </p>
                </div>
              </label>
            )}

            {/* Mapeamento de colunas */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Mapeamento de colunas (ajuste se necessário):
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cabecalhosOriginais.map(h => (
                  <div key={h} className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={h}>
                      {h}
                    </span>
                    <select
                      value={mapeamento[h] || ''}
                      onChange={(e) => atualizarMapeamento(h, e.target.value)}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      {camposDisponiveis.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Erros */}
            {erros.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300 text-sm font-medium mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  {erros.length} aviso(s) encontrado(s)
                </div>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 max-h-24 overflow-y-auto">
                  {erros.slice(0, 10).map((e, i) => (
                    <li key={i}>Linha {e.linha}: {e.mensagem}</li>
                  ))}
                  {erros.length > 10 && <li>... e mais {erros.length - 10} avisos</li>}
                </ul>
              </div>
            )}

            {/* Tabela preview */}
            <div className="max-h-64 overflow-auto border rounded-lg dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Código</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Razão Social</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">CNPJ</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cidade/UF</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {empresasComStatus.slice(0, 50).map((emp, i) => (
                    <tr
                      key={i}
                      className={emp.jaCadastrada
                        ? 'bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                    >
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        {emp.jaCadastrada ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Já existe
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Nova
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{emp.codigo || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]">{emp.razao_social || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 font-mono text-xs">{emp.cnpj || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{[emp.cidade, emp.estado].filter(Boolean).join('/') || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-xs">{emp.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {empresas.length > 50 && (
                <div className="text-center text-xs text-gray-500 py-2">
                  Mostrando 50 de {empresas.length} empresas
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              {(() => {
                const qtd = apenasNovas ? totalNovas : empresas.length;
                return (
                  <button
                    onClick={handleImportar}
                    disabled={qtd === 0}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Importar {qtd} empresa{qtd !== 1 ? 's' : ''}
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* ETAPA 3: Importando */}
        {etapa === 'importando' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              Importando {empresas.length} empresas...
            </p>
            <p className="text-sm text-gray-500">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* ETAPA 4: Resultado */}
        {etapa === 'resultado' && resultado && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Importação Concluída!
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{resultado.criadas}</p>
                <p className="text-sm text-green-700 dark:text-green-400">Criadas</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-600">{resultado.duplicadas}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">Duplicadas</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{resultado.erros}</p>
                <p className="text-sm text-red-700 dark:text-red-400">Erros</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => { setEtapa('upload'); setArquivo(null); setEmpresas([]); setResultado(null); }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                Importar Mais
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
