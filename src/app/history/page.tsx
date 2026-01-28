'use client';

import { useState, useEffect } from 'react';
import { Download, Trash2, CheckCircle2, XCircle, Clock, Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, formatCurrency } from '@/lib/utils';

interface ImportHistory {
  id: string;
  date: string;
  marketplace?: string;
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  recordsCount: number;
  errorDetails?: string | null;
  finishedAt?: string | null;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState<ImportHistory | null>(null);

  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const fileNameMatch = item.fileName?.toLowerCase().includes(searchLower) || false;
    const marketplaceMatch = item.marketplace?.toLowerCase().includes(searchLower) || false;
    return fileNameMatch || marketplaceMatch;
  });

  const getStatusIcon = (status: ImportHistory['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'failed':
        return <XCircle className="w-5 h-5" />;
      case 'processing':
        return <Clock className="w-5 h-5" />;
      case 'pending':
        return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: ImportHistory['status']) => {
    switch (status) {
      case 'success':
        return 'Sucesso';
      case 'failed':
        return 'Erro';
      case 'processing':
        return 'Processando';
      case 'pending':
        return 'Pendente';
    }
  };

  const getStatusColor = (status: ImportHistory['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'processing':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'pending':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  useEffect(() => {
    fetchImports();
    // Atualiza a cada 5 segundos se houver importações processando
    const interval = setInterval(() => {
      if (history.some(h => h.status === 'processing' || h.status === 'pending')) {
        fetchImports();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchImports = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/imports');
      
      // Verifica content-type SEM ler o body
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      // Lê o body como texto (sempre funciona, mesmo se for JSON)
      const text = await response.text();

      if (!response.ok) {
        // Para erros, tenta fazer parse como JSON se o content-type indicar
        if (isJson && text.trim()) {
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.error || `Erro ${response.status}`);
          } catch (parseError: any) {
            // Se já é um Error que lançamos, propaga
            if (parseError instanceof Error && parseError.message.includes('Erro')) {
              throw parseError;
            }
            // Se falhou o parse JSON, usa o texto original
            throw new Error(`Erro ${response.status}: ${text.substring(0, 200) || 'Erro desconhecido'}`);
          }
        } else {
          throw new Error(`Erro ${response.status}: ${text.substring(0, 200) || 'Erro desconhecido'}`);
        }
      }

      // Para sucesso, sempre espera JSON
      if (!isJson) {
        throw new Error(`Resposta inválida (esperado JSON): ${text.substring(0, 200)}`);
      }

      if (!text || text.trim() === '') {
        setHistory([]);
        return;
      }

      // Faz parse do JSON manualmente
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON:', parseError);
        console.error('Resposta recebida:', text.substring(0, 500));
        throw new Error('Resposta inválida do servidor: não foi possível fazer parse do JSON');
      }

      // Valida estrutura
      if (!data || typeof data !== 'object') {
        setHistory([]);
        return;
      }

      setHistory(data.imports || []);
    } catch (error: any) {
      console.error('Erro ao buscar importações:', error);
      // Define array vazio em caso de erro para não quebrar a UI
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchImportDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/imports/${id}`);
      
      // Verifica content-type SEM ler o body
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      // Lê o body como texto (sempre funciona, mesmo se for JSON)
      const text = await response.text();

      if (!response.ok) {
        // Para erros, tenta fazer parse como JSON se o content-type indicar
        if (isJson && text.trim()) {
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.error || `Erro ${response.status}`);
          } catch (parseError: any) {
            // Se já é um Error que lançamos, propaga
            if (parseError instanceof Error && parseError.message.includes('Erro')) {
              throw parseError;
            }
            // Se falhou o parse JSON, usa o texto original
            throw new Error(`Erro ${response.status}: ${text.substring(0, 200) || 'Erro desconhecido'}`);
          }
        } else {
          throw new Error(`Erro ${response.status}: ${text.substring(0, 200) || 'Erro desconhecido'}`);
        }
      }

      // Para sucesso, sempre espera JSON
      if (!isJson) {
        throw new Error('Resposta inválida do servidor: esperado JSON');
      }

      if (!text || text.trim() === '') {
        throw new Error('Resposta vazia do servidor');
      }

      // Faz parse do JSON manualmente
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON:', parseError);
        console.error('Resposta recebida:', text.substring(0, 500));
        throw new Error('Resposta inválida do servidor: não foi possível fazer parse do JSON');
      }

      // Valida estrutura
      if (!data || typeof data !== 'object' || !data.import) {
        throw new Error('Resposta inválida: estrutura de dados incorreta');
      }

      setSelectedImport({ 
        ...data.import, 
        recordsCount: data.statistics?.ordersCount || 0 
      });
    } catch (error: any) {
      console.error('Erro ao buscar detalhes:', error);
      alert(`Erro ao buscar detalhes: ${error.message}`);
    }
  };

  const handleViewDetails = (importItem: ImportHistory) => {
    fetchImportDetails(importItem.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta importação?')) {
      // TODO: Implementar API de exclusão
      console.log('Deletar importação:', id);
    }
  };

  const handleRefresh = () => {
    fetchImports();
  };

  if (isLoading && history.length === 0) {
    return (
      <main className="p-4 md:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando importações...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Importações</h1>
          <p className="text-muted-foreground">
            Visualize todas as importações realizadas e seus status
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      {history.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{history.length}</div>
              <p className="text-xs text-muted-foreground">Total de Importações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {history.filter(h => h.status === 'success').length}
              </div>
              <p className="text-xs text-muted-foreground">Com Sucesso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {history.filter(h => h.status === 'failed').length}
              </div>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {history.reduce((sum, h) => sum + h.recordsCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total de Pedidos</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Importações</CardTitle>
              <CardDescription>
                Lista completa de arquivos importados
              </CardDescription>
            </div>
            <Input
              placeholder="Buscar por arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium">Data</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Arquivo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Pedidos</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-24 text-center text-muted-foreground">
                        {history.length === 0 
                          ? 'Nenhuma importação realizada ainda' 
                          : 'Nenhuma importação encontrada com o filtro'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <td className="p-4 align-middle">
                          <div>
                            <div>{formatDate(new Date(item.date))}</div>
                            {item.finishedAt && (
                              <div className="text-xs text-muted-foreground">
                                Finalizado: {formatDate(new Date(item.finishedAt))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="font-mono text-sm">{item.fileName}</div>
                          {item.errorDetails && (
                            <div className="text-xs text-red-600 mt-1 max-w-md truncate">
                              {item.errorDetails}
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit ${getStatusColor(item.status)}`}>
                            {getStatusIcon(item.status)}
                            <span className="font-medium">{getStatusText(item.status)}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-right">
                          {item.status === 'success' ? (
                            <span className="font-semibold text-green-600">{item.recordsCount}</span>
                          ) : item.status === 'failed' ? (
                            <span className="text-red-600">0</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(item)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Mostrando {filteredHistory.length} de {history.length} importações
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      {selectedImport && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes da Importação</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedImport(null)}>
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Arquivo</p>
                <p className="font-mono text-sm">{selectedImport.fileName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit mt-1 ${getStatusColor(selectedImport.status)}`}>
                  {getStatusIcon(selectedImport.status)}
                  <span className="font-medium">{getStatusText(selectedImport.status)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Criação</p>
                <p>{formatDate(new Date(selectedImport.date))}</p>
              </div>
              {selectedImport.finishedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de Finalização</p>
                  <p>{formatDate(new Date(selectedImport.finishedAt))}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Importados</p>
                <p className="text-2xl font-bold">{selectedImport.recordsCount}</p>
              </div>
            </div>
            {selectedImport.errorDetails && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Erro:</p>
                <p className="text-sm text-red-700 dark:text-red-300">{selectedImport.errorDetails}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
