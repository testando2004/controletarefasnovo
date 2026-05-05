'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Edit, FileText, Users, Calculator, FileCheck, Briefcase, Headphones, Scale, CheckCircle, Building2, Landmark, ShieldCheck, Truck, Package, Heart, Wallet, CreditCard, BarChart3, PieChart, Settings, Wrench, Globe, Mail, Phone, MessageSquare, Clipboard, FolderOpen, Archive, BookOpen, GraduationCap, Award, Target, Flag, Zap, Star } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import * as LucideIcons from 'lucide-react';

interface ModalCriarDepartamentoProps {
  onClose: () => void;
  onSave: (departamento: any) => void;
  departamento?: any;
}

export default function ModalCriarDepartamento({
  onClose,
  onSave,
  departamento,
}: ModalCriarDepartamentoProps) {
  const { mostrarAlerta, usuarios } = useSistema();
  const [formData, setFormData] = useState({
    nome: departamento?.nome || '',
    responsavel: departamento?.responsavel || '',
    descricao: departamento?.descricao || '',
    cor: departamento?.cor || 'from-cyan-500 to-blue-600',
    icone: (() => {
      // Normalizar ícone - garantir que seja sempre uma string com o nome do ícone
      if (!departamento?.icone) return 'FileText';
      if (typeof departamento.icone === 'string') {
        // Verificar se é um dos nomes válidos
        const nomesValidos = ['FileText', 'Users', 'Calculator', 'FileCheck', 'Briefcase', 'Edit', 'Headphones', 'Scale', 'CheckCircle'];
        return nomesValidos.includes(departamento.icone) ? departamento.icone : 'FileText';
      }
      return 'FileText';
    })(),
  });

  const coresDisponiveis = [
    { nome: 'Azul', gradient: 'from-blue-500 to-blue-700', solida: 'bg-blue-600' },
    { nome: 'Ciano', gradient: 'from-cyan-500 to-cyan-700', solida: 'bg-cyan-600' },
    { nome: 'Índigo', gradient: 'from-indigo-500 to-indigo-700', solida: 'bg-indigo-600' },
    { nome: 'Roxo', gradient: 'from-purple-500 to-purple-700', solida: 'bg-purple-600' },
    { nome: 'Rosa', gradient: 'from-pink-500 to-pink-700', solida: 'bg-pink-600' },
    { nome: 'Vermelho', gradient: 'from-red-500 to-red-700', solida: 'bg-red-600' },
    { nome: 'Laranja', gradient: 'from-orange-500 to-orange-700', solida: 'bg-orange-600' },
    { nome: 'Amarelo', gradient: 'from-yellow-500 to-yellow-600', solida: 'bg-yellow-500' },
    { nome: 'Lima', gradient: 'from-lime-500 to-lime-700', solida: 'bg-lime-600' },
    { nome: 'Verde', gradient: 'from-green-500 to-green-700', solida: 'bg-green-600' },
    { nome: 'Esmeralda', gradient: 'from-emerald-500 to-emerald-700', solida: 'bg-emerald-600' },
    { nome: 'Turquesa', gradient: 'from-teal-500 to-teal-700', solida: 'bg-teal-600' },
    { nome: 'Cinza', gradient: 'from-slate-500 to-slate-700', solida: 'bg-slate-600' },
    { nome: 'Marrom', gradient: 'from-amber-700 to-amber-900', solida: 'bg-amber-800' },
    { nome: 'Vinho', gradient: 'from-rose-700 to-rose-900', solida: 'bg-rose-800' },
    { nome: 'Azul Escuro', gradient: 'from-blue-700 to-blue-900', solida: 'bg-blue-800' },
  ];

  const iconesDisponiveis = [
    { nome: 'FileText', componente: FileText, label: 'Documento' },
    { nome: 'Users', componente: Users, label: 'Usuários' },
    { nome: 'Calculator', componente: Calculator, label: 'Calculadora' },
    { nome: 'FileCheck', componente: FileCheck, label: 'Verificação' },
    { nome: 'Briefcase', componente: Briefcase, label: 'Maleta' },
    { nome: 'Edit', componente: Edit, label: 'Editar' },
    { nome: 'Headphones', componente: Headphones, label: 'Atendimento' },
    { nome: 'Scale', componente: Scale, label: 'Jurídico' },
    { nome: 'CheckCircle', componente: CheckCircle, label: 'Conclusão' },
    { nome: 'Building2', componente: Building2, label: 'Empresa' },
    { nome: 'Landmark', componente: Landmark, label: 'Banco' },
    { nome: 'ShieldCheck', componente: ShieldCheck, label: 'Segurança' },
    { nome: 'Truck', componente: Truck, label: 'Logística' },
    { nome: 'Package', componente: Package, label: 'Estoque' },
    { nome: 'Heart', componente: Heart, label: 'Saúde' },
    { nome: 'Wallet', componente: Wallet, label: 'Carteira' },
    { nome: 'CreditCard', componente: CreditCard, label: 'Pagamentos' },
    { nome: 'BarChart3', componente: BarChart3, label: 'Gráficos' },
    { nome: 'PieChart', componente: PieChart, label: 'Análise' },
    { nome: 'Settings', componente: Settings, label: 'Configurações' },
    { nome: 'Wrench', componente: Wrench, label: 'Manutenção' },
    { nome: 'Globe', componente: Globe, label: 'Global' },
    { nome: 'Mail', componente: Mail, label: 'E-mail' },
    { nome: 'Phone', componente: Phone, label: 'Telefone' },
    { nome: 'MessageSquare', componente: MessageSquare, label: 'Chat' },
    { nome: 'Clipboard', componente: Clipboard, label: 'Tarefas' },
    { nome: 'FolderOpen', componente: FolderOpen, label: 'Pasta' },
    { nome: 'Archive', componente: Archive, label: 'Arquivo' },
    { nome: 'BookOpen', componente: BookOpen, label: 'Manual' },
    { nome: 'GraduationCap', componente: GraduationCap, label: 'Treinamento' },
    { nome: 'Award', componente: Award, label: 'Prêmio' },
    { nome: 'Target', componente: Target, label: 'Meta' },
    { nome: 'Flag', componente: Flag, label: 'Marco' },
    { nome: 'Zap', componente: Zap, label: 'Energia' },
    { nome: 'Star', componente: Star, label: 'Destaque' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      void mostrarAlerta('Atenção', 'Digite o nome do departamento!', 'aviso');
      return;
    }

    if (!formData.responsavel.trim()) {
      void mostrarAlerta('Atenção', 'Digite o nome do responsável!', 'aviso');
      return;
    }

    const corSelecionada = coresDisponiveis.find(c => c.gradient === formData.cor);
    const iconeSelecionado = iconesDisponiveis.find(i => i.nome === formData.icone);

    onSave({
      id: departamento?.id || Date.now(),
      nome: formData.nome,
      responsavel: formData.responsavel,
      descricao: formData.descricao,
      cor: formData.cor,
      corSolida: corSelecionada?.solida,
      icone: iconeSelecionado?.nome || 'FileText', // Sempre salvar o nome do ícone como string
      criadoEm: departamento?.criadoEm || new Date(),
    });

    onClose();
  };

  const iconeAtualInfo = iconesDisponiveis.find(i => i.nome === formData.icone);
  const IconeAtual = iconeAtualInfo?.componente || FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black bg-opacity-60 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-0.75rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        {/* Header com gradiente */}
        <div className={`bg-gradient-to-r ${formData.cor} p-6 rounded-t-2xl sticky top-0`}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">
              {departamento ? 'Editar Departamento' : 'Criar Novo Departamento'}
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
          {/* Nome do Departamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome do Departamento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value.slice(0, 40) })}
              maxLength={40}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              placeholder="Ex: Cadastro, RH, Fiscal..."
              required
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Responsável <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 mb-2"
            >
              <option value="">Selecione um usuário...</option>
              {(Array.isArray(usuarios) ? usuarios : [])
                .filter((u: any) => u?.ativo !== false)
                .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR'))
                .map((u: any) => (
                  <option key={u.id} value={u.nome}>
                    {u.nome}{u.email ? ` (${u.email})` : ''}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mb-2">Ou digite manualmente abaixo.</p>
            <input
              type="text"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value.slice(0, 40) })}
              maxLength={40}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              placeholder="Nome do responsável"
              required
            />
          </div>

          {/* Descrição */}
        

          {/* Cor do Departamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cor do Departamento
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {coresDisponiveis.map((cor) => (
                <button
                  key={cor.nome}
                  type="button"
                  onClick={() => setFormData({ ...formData, cor: cor.gradient })}
                  className={`p-4 rounded-xl bg-gradient-to-r ${cor.gradient} text-white font-medium transition-all ${
                    formData.cor === cor.gradient
                      ? 'ring-4 ring-offset-2 ring-gray-400 scale-105'
                      : 'hover:scale-105'
                  }`}
                >
                  {cor.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Ícone do Departamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ícone do Departamento
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 max-h-48 overflow-y-auto p-1">
              {iconesDisponiveis.map((icone) => {
                const IconeComp = icone.componente;
                return (
                  <button
                    key={icone.nome}
                    type="button"
                    onClick={() => setFormData({ ...formData, icone: icone.nome })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.icone === icone.nome
                        ? 'border-cyan-500 bg-cyan-50 scale-110'
                        : 'border-gray-300 hover:border-cyan-300 hover:scale-105'
                    }`}
                    title={icone.label || icone.nome}
                  >
                    <IconeComp
                      size={24}
                      className={
                        formData.icone === icone.nome
                          ? 'text-cyan-600'
                          : 'text-gray-600'
                      }
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview do Departamento */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Preview:</h4>
            <div className={`bg-gradient-to-br ${formData.cor} p-4 rounded-xl text-white`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <IconeAtual size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-lg">
                    {formData.nome || 'Nome do Departamento'}
                  </h5>
                  <p className="text-sm opacity-90">
                    {formData.responsavel || 'Responsável'}
                  </p>
                </div>
              </div>
              {formData.descricao && (
                <p className="mt-3 text-sm opacity-90">
                  {formData.descricao}
                </p>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium"
            >
              {departamento ? 'Salvar Alterações' : 'Criar Departamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
