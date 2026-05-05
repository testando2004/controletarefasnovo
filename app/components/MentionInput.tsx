'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Usuario } from '@/app/types';
import { User } from 'lucide-react';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  usuarios: Usuario[];
  placeholder?: string;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

export default function MentionInput({
  value,
  onChange,
  usuarios,
  placeholder = 'Digite seu comentário...',
  rows = 3,
  onKeyDown,
  className = '',
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<Usuario[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    // Detectar @ antes do cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Verificar se ainda estamos digitando a menção (sem espaços)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        const query = textAfterAt.toLowerCase();
        const filtered = usuarios.filter(
          (u) =>
            u.nome.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        );

        setFilteredUsers(filtered);
        setMentionStart(lastAtIndex);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
  };

  const insertMention = (usuario: Usuario) => {
    if (mentionStart === null || !textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(cursorPos);
    const mention = `@${usuario.nome.replace(/\s+/g, '_')}`;
    const newValue = beforeMention + mention + ' ' + afterCursor;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(null);

    // Reposicionar cursor após a menção
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mention.length + 1;
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    onKeyDown?.(e);
  };

  // Renderizar texto com menções destacadas
  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@[A-Za-z0-9_À-ÖØ-öø-ÿ]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={idx}
            className="bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 px-1 rounded font-medium"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
          focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none
          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500 ${className}`}
      />

      {/* Sugestões de menções */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
            rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto"
        >
          <div className="p-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            Use ↑↓ para navegar, Enter para selecionar
          </div>
          {filteredUsers.map((usuario, index) => (
            <button
              key={usuario.id}
              onClick={() => insertMention(usuario)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 
                transition-colors flex items-center gap-3 ${
                  index === selectedIndex
                    ? 'bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500'
                    : ''
                }`}
            >
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 
                  flex items-center justify-center text-white font-bold text-sm"
              >
                {usuario.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {usuario.nome}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {usuario.email}
                </div>
              </div>
              {index === selectedIndex && (
                <User size={16} className="text-purple-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Dica de uso */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Digite <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">@</span> para mencionar usuários •{' '}
        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl+Enter</span> para enviar
      </div>
    </div>
  );
}
