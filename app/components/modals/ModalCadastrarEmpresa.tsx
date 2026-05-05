'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Empresa } from '@/app/types';
import ModalBase from './ModalBase';
import { cepSchema, cpfSchema, cnpjSchema } from '@/app/utils/validation';
import { api } from '@/app/utils/api';

interface ModalCadastrarEmpresaProps {
  onClose: () => void;
  empresa?: Empresa;
}

export default function ModalCadastrarEmpresa({ onClose, empresa }: ModalCadastrarEmpresaProps) {
  const { criarEmpresa, atualizarEmpresa, mostrarAlerta } = useSistema();

  const [empresaCadastrada, setEmpresaCadastrada] = useState(empresa ? empresa.cadastrada !== false : false);

  const [formData, setFormData] = useState<Partial<Empresa>>({
    cnpj: '',
    codigo: '',
    razao_social: '',
    apelido: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    regime_federal: '',
    regime_estadual: '',
    regime_municipal: '',
    data_abertura: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    cep: '',
    cadastrada: empresaCadastrada,
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string>('');

  const cnpjDigits = useMemo(() => String(formData.cnpj || '').replace(/\D/g, ''), [formData.cnpj]);
  const podeBuscarCnpj = cnpjDigits.length === 14 && !buscandoCnpj;

  const handleBuscarCnpj = async () => {
    const digits = String(formData.cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) {
      setCnpjLookupError('Digite um CNPJ com 14 dígitos para buscar.');
      return;
    }

    const parsed = cnpjSchema.safeParse(String(formData.cnpj || ''));
    if (!parsed.success) {
      setCnpjLookupError('CNPJ inválido. Verifique e tente novamente.');
      return;
    }

    setBuscandoCnpj(true);
    setCnpjLookupError('');
    try {
      const data = await api.consultarCnpj(digits);

      setFormData((prev) => {
        const cepDigits = String(data?.cep || '').replace(/\D/g, '');
        const cepFormatado = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5, 8)}` : String(data?.cep || '');
        const numeroDigits = String(data?.numero || '').replace(/\D/g, '');

        return {
          ...prev,
          razao_social: String(prev.razao_social || '').trim() ? prev.razao_social : (data?.razao_social || ''),
          apelido: String(prev.apelido || '').trim() ? prev.apelido : (data?.nome_fantasia || ''),
          data_abertura: String(prev.data_abertura || '').trim() ? prev.data_abertura : (data?.data_abertura || ''),
          estado: String(prev.estado || '').trim() ? prev.estado : (data?.estado || ''),
          cidade: String(prev.cidade || '').trim() ? prev.cidade : (data?.cidade || ''),
          bairro: String(prev.bairro || '').trim() ? prev.bairro : (data?.bairro || ''),
          logradouro: String(prev.logradouro || '').trim() ? prev.logradouro : (data?.logradouro || ''),
          numero: String(prev.numero || '').trim() ? prev.numero : (numeroDigits || ''),
          cep: String(prev.cep || '').trim() ? prev.cep : (cepFormatado || ''),
          email: String(prev.email || '').trim() ? prev.email : (data?.email || ''),
          telefone: String(prev.telefone || '').trim() ? prev.telefone : (data?.telefone || ''),
        };
      });

      setEmpresaCadastrada(true);
    } catch (error: any) {
      setCnpjLookupError(error?.message || 'Não foi possível consultar esse CNPJ agora.');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleChange = (field: keyof Empresa, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      cadastrada: empresaCadastrada,
    }));
  }, [empresaCadastrada]);

  useEffect(() => {
    if (empresa) {
      // Substituir valores null por '' para evitar warning de value={null} em inputs
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(empresa)) {
        sanitized[key] = val === null ? '' : val;
      }
      setFormData(sanitized as Partial<Empresa>);
      setEmpresaCadastrada(empresa.cadastrada !== false);
    }
  }, [empresa]);

  const formatarCPFCNPJ = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');

    if (apenasNumeros.length <= 11) {
      // Formatar como CPF: 000.000.000-00
      return apenasNumeros
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    } else {
      // Formatar como CNPJ: 00.000.000/0000-00
      return apenasNumeros
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    }
  };

  const formatarCEP = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 5) {
      return apenasNumeros;
    }
    return `${apenasNumeros.slice(0, 5)}-${apenasNumeros.slice(5, 8)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica com zod (CPF/CNPJ/CEP) e obrigatórios
    const novosErros: Record<string, string> = {};
    if (!formData.codigo) novosErros.codigo = 'Código é obrigatório';

    const digits = String(formData.cnpj || '').replace(/\D/g, '');
    if (digits.length === 11) {
      const parsed = cpfSchema.safeParse(String(formData.cnpj || ''));
      if (!parsed.success) novosErros.cnpj = 'CPF inválido';
    } else if (digits.length === 14) {
      const parsed = cnpjSchema.safeParse(String(formData.cnpj || ''));
      if (!parsed.success) novosErros.cnpj = 'CNPJ inválido';
    }
    if (formData.cep) {
      const parsedCep = cepSchema.safeParse(String(formData.cep || ''));
      if (!parsedCep.success) novosErros.cep = 'CEP inválido';
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    if (!formData.codigo) {
      void mostrarAlerta('Campos obrigatórios', 'Código é obrigatório.', 'aviso');
      return;
    }

    // Determinar se é empresa cadastrada baseado no CNPJ
    const cnpjDigits = String(formData.cnpj || '').replace(/\D/g, '');
    // Empresa cadastrada: precisa ter CNPJ válido (14 dígitos) OU CPF válido (11 dígitos)
    // Mas no contexto do sistema, empresas cadastradas devem ter CNPJ (14 dígitos)
    const temCnpjValido = cnpjDigits.length === 14;
    
    // Se o tipo selecionado é "empresa cadastrada", deve ter CNPJ válido
    // Caso contrário, se tem CNPJ válido, considera cadastrada automaticamente
    let cadastrada = false;
    if (empresaCadastrada) {
      // Se selecionou empresa cadastrada, precisa ter CNPJ válido
      cadastrada = temCnpjValido;
    } else {
      // Se selecionou empresa nova, mas tem CNPJ válido, considera cadastrada
      cadastrada = temCnpjValido;
    }

    const dadosParaSalvar: Partial<Empresa> = {
      ...formData,
      cnpj: formData.cnpj ? String(formData.cnpj) : undefined,
      cadastrada: cadastrada,
    };

    if (empresa?.id) {
      atualizarEmpresa(empresa.id, dadosParaSalvar);
    } else {
      criarEmpresa(dadosParaSalvar);
    }

    onClose();
  };

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="empresa-title" dialogClassName="w-full max-w-4xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto" zIndex={1300}>
      <div className="rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h3 id="empresa-title" className="text-xl font-bold text-white">
              {empresa ? "Editar Empresa" : "Cadastrar Nova Empresa"}
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}>
          {/* Tipo de Empresa */}
          <div className="bg-blue-50 dark:bg-[#102236] rounded-xl p-4 border border-blue-200 dark:border-[#1d4ed8]">
            <h4 className="font-semibold text-blue-800 mb-4">Tipo de Empresa</h4>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-[var(--card)] p-4 rounded-lg border-2 border-gray-200 dark:border-[var(--border)] hover:border-blue-500 transition-all flex-1">
                <input
                  type="radio"
                  name="tipoCadastro"
                  checked={empresaCadastrada}
                  onChange={() => setEmpresaCadastrada(true)}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">Empresa Cadastrada</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Já possui CNPJ e Razão Social</div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-[var(--card)] p-4 rounded-lg border-2 border-gray-200 dark:border-[var(--border)] hover:border-blue-500 transition-all flex-1">
                <input
                  type="radio"
                  name="tipoCadastro"
                  checked={!empresaCadastrada}
                  onChange={() => setEmpresaCadastrada(false)}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">Empresa Nova</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Ainda não possui CNPJ</div>
                </div>
              </label>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="bg-green-50 dark:bg-[#10291f] rounded-xl p-4 border border-green-200 dark:border-[#15803d]">
            <h4 className="font-semibold text-green-800 mb-4">
              Dados Principais {empresaCadastrada && '*'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPF/CNPJ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPF/CNPJ {empresaCadastrada && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={String(formData.cnpj || '')}
                    onChange={(e) => {
                      const valorFormatado = formatarCPFCNPJ(e.target.value);
                      handleChange('cnpj', valorFormatado);

                      const digits = valorFormatado.replace(/\D/g, '');
                      setEmpresaCadastrada(digits.length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.ctrlKey || e.metaKey ||
                        ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                        /^[0-9]$/.test(e.key)
                      ) return;
                      e.preventDefault();
                    }}
                    className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-green-500 ${erros.cnpj ? 'border-red-500' : 'border-gray-300 dark:border-[var(--border)]'} bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]`}
                    placeholder={empresaCadastrada ? "000.000.000-00 ou 00.000.000/0000-00" : "Opcional"}
                    required={false}
                    maxLength={18}
                  />

                  <button
                    type="button"
                    onClick={handleBuscarCnpj}
                    disabled={!podeBuscarCnpj}
                    title={cnpjDigits.length === 14 ? 'Buscar dados do CNPJ' : 'Digite um CNPJ com 14 dígitos'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--card)] hover:bg-gray-50 dark:hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Buscar dados do CNPJ"
                  >
                    {buscandoCnpj ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </div>
                {erros.cnpj && <p className="mt-1 text-sm text-red-500">{erros.cnpj}</p>}
                {!erros.cnpj && cnpjLookupError && (
                  <p className="mt-1 text-sm text-red-500">{cnpjLookupError}</p>
                )}
              </div>

              {/* Código */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={String(formData.codigo || '')}
                  onChange={(e) => handleChange('codigo', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 ${erros.codigo ? 'border-red-500' : 'border-gray-300 dark:border-[var(--border)]'} bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]`}
                  placeholder="001"
                  required
                />
                {erros.codigo && <p className="mt-1 text-sm text-red-500">{erros.codigo}</p>}
              </div>
            </div>

            {/* Razão Social e Apelido */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Razão Social
                </label>
                <input
                  type="text"
                  value={String(formData.razao_social || '')}
                  onChange={(e) => handleChange('razao_social', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 ${erros.razao_social ? 'border-red-500' : 'border-gray-300 dark:border-[var(--border)]'} bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]`}
                  placeholder={empresaCadastrada ? "Nome oficial da empresa" : "Nome provisório (opcional)"}
                />
                {erros.razao_social && <p className="mt-1 text-sm text-red-500">{erros.razao_social}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Apelido/Nome Fantasia
                </label>
                <input
                  type="text"
                  value={String(formData.apelido || '')}
                  onChange={(e) => handleChange('apelido', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-green-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                  placeholder="Apelido"
                />
              </div>
            </div>

            {!empresaCadastrada && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Empresa não cadastrada:</strong> Os campos CNPJ e Razão Social são opcionais.
                  Complete estas informações quando a empresa for oficializada.
                </p>
              </div>
            )}
          </div>

          {/* Inscrições e Regimes */}
          <div className="bg-blue-50 dark:bg-[#0f2036] rounded-xl p-4 border border-blue-200 dark:border-[#1e3a8a] mt-6">
            <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={formData.inscricao_estadual}
                  onChange={(e) => handleChange('inscricao_estadual', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Inscrição Municipal
                </label>
                <input
                  type="text"
                  value={formData.inscricao_municipal}
                  onChange={(e) => handleChange('inscricao_municipal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Regime Federal
                </label>
                <select
                  value={formData.regime_federal}
                  onChange={(e) => handleChange('regime_federal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                >
                  <option value="">Selecione...</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Lucro Real">Lucro Real</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Regime Estadual
                </label>
                <input
                  type="text"
                  value={formData.regime_estadual}
                  onChange={(e) => handleChange('regime_estadual', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Regime Municipal
                </label>
                <input
                  type="text"
                  value={formData.regime_municipal}
                  onChange={(e) => handleChange('regime_municipal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-purple-50 dark:bg-[#1f1630] rounded-xl p-4 border border-purple-200 dark:border-[#6d28d9] mt-6">
            <h4 className="font-semibold text-purple-800 mb-4">Endereço</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CEP
                </label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    const valorFormatado = formatarCEP(apenasNumeros);
                    handleChange('cep', valorFormatado);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.ctrlKey || e.metaKey ||
                      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                      /^[0-9]$/.test(e.key)
                    ) return;
                    e.preventDefault();
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 ${erros.cep ? 'border-red-500' : 'border-gray-300 dark:border-[var(--border)]'} bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]`}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {erros.cep && <p className="mt-1 text-sm text-red-500">{erros.cep}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => handleChange('estado', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                >
                  <option value="">Selecione...</option>
                  <option value="AC">AC</option>
                  <option value="AL">AL</option>
                  <option value="AP">AP</option>
                  <option value="AM">AM</option>
                  <option value="BA">BA</option>
                  <option value="CE">CE</option>
                  <option value="DF">DF</option>
                  <option value="ES">ES</option>
                  <option value="GO">GO</option>
                  <option value="MA">MA</option>
                  <option value="MT">MT</option>
                  <option value="MS">MS</option>
                  <option value="MG">MG</option>
                  <option value="PA">PA</option>
                  <option value="PB">PB</option>
                  <option value="PR">PR</option>
                  <option value="PE">PE</option>
                  <option value="PI">PI</option>
                  <option value="RJ">RJ</option>
                  <option value="RN">RN</option>
                  <option value="RS">RS</option>
                  <option value="RO">RO</option>
                  <option value="RR">RR</option>
                  <option value="SC">SC</option>
                  <option value="SP">SP</option>
                  <option value="SE">SE</option>
                  <option value="TO">TO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => handleChange('cidade', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => handleChange('bairro', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Logradouro
                </label>
                <input
                  type="text"
                  value={formData.logradouro}
                  onChange={(e) => handleChange('logradouro', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                  placeholder="Rua, Avenida..."
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número
              </label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => {
                  const apenasNumeros = e.target.value.replace(/\D/g, '');
                  handleChange('numero', apenasNumeros);
                }}
                onKeyDown={(e) => {
                  if (
                    e.ctrlKey || e.metaKey ||
                    ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                    /^[0-9]$/.test(e.key)
                  ) return;
                  e.preventDefault();
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-[var(--border)] rounded-xl hover:bg-gray-100 dark:hover:bg-[var(--muted)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              {empresa ? "Salvar Alterações" : "Cadastrar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </ModalBase>
  );
}
