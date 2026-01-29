'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [marketplace, setMarketplace] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [importResult, setImportResult] = useState<{
    marketplace?: string;
    marketplaceHint?: string;
    orderCount?: number;
    skipped?: number;
    totalProcessed?: number;
    message?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          selectedFile.type === 'application/vnd.ms-excel' ||
          selectedFile.name.endsWith('.xlsx') ||
          selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setUploadStatus('idle');
        setErrorMessage('');
      } else {
        setErrorMessage('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !marketplace) {
      setErrorMessage('Por favor, selecione um arquivo e um marketplace');
      setUploadStatus('error');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Se não houver storeId selecionado, será criado automaticamente
      formData.append('storeId', 'temp-store-id');
      // IMPORTANTE: Envia o marketplace selecionado para garantir a detecção correta
      formData.append('marketplace', marketplace);

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      // CRÍTICO: Lê o body apenas UMA vez como texto
      // Esta é a ÚNICA leitura do body - nunca leia novamente!
      const responseText = await response.text();
      
      // Verifica content-type (sem ler o body novamente)
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      // Processa a resposta baseado no status
      if (!response.ok) {
        // Erro: tenta parse JSON, senão usa texto direto
        let errorMessage = `Erro ${response.status}`;
        
        if (isJson && responseText.trim()) {
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Se não conseguir fazer parse, usa o texto original
            errorMessage = responseText.substring(0, 200) || errorMessage;
          }
        } else {
          errorMessage = responseText.substring(0, 200) || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // Sucesso: sempre espera JSON
      if (!isJson) {
        throw new Error(`Resposta inválida (esperado JSON, recebido ${contentType}): ${responseText.substring(0, 200)}`);
      }

      if (!responseText || responseText.trim() === '') {
        throw new Error('Resposta vazia do servidor');
      }

      // Faz parse do JSON
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[handleUpload] Erro ao fazer parse do JSON:', parseError);
        console.error('[handleUpload] Resposta recebida:', responseText.substring(0, 500));
        throw new Error('Resposta inválida: não foi possível fazer parse do JSON');
      }

      // Valida estrutura
      if (!result || typeof result !== 'object') {
        throw new Error('Resposta inválida: estrutura de dados incorreta');
      }
      
      setUploadStatus('success');
      setImportResult({
        marketplace: result.marketplace,
        marketplaceHint: result.marketplaceHint, // Debug
        orderCount: result.orderCount || 0,
        skipped: result.skipped || 0,
        totalProcessed: result.totalProcessed || 0,
        message: result.message,
      });

      // Redireciona para histórico após 3 segundos
      setTimeout(() => {
        router.push('/history');
      }, 3000);
    } catch (error: any) {
      console.error('Erro completo:', error);
      setUploadStatus('error');
      const errorMsg = error?.message || error?.toString() || 'Erro ao fazer upload do arquivo. Tente novamente.';
      setErrorMessage(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Dados</h1>
        <p className="text-muted-foreground">
          Faça upload de arquivos Excel com dados de vendas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>
            Selecione o marketplace e o arquivo Excel para importar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="marketplace">Marketplace</Label>
            <Select
              id="marketplace"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              disabled={isUploading}
            >
              <option value="">Selecione um marketplace</option>
              <option value="mercadolivre">Mercado Livre</option>
              <option value="shopee">Shopee</option>
              <option value="shein">Shein</option>
              <option value="tiktok">TikTok Shop</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo Excel</Label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    XLSX ou XLS (MAX. 10MB)
                  </p>
                </div>
                <input
                  id="file"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>
            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}
          </div>

          {uploadStatus === 'success' && importResult && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                  Importação concluída com sucesso!
                </p>
              </div>
              <div className="pl-7 space-y-1 text-sm text-green-700 dark:text-green-300">
                <p>Marketplace detectado: <strong>{importResult.marketplace}</strong></p>
                <p>Marketplace selecionado: <strong>{importResult.marketplaceHint || 'N/A'}</strong></p>
                <p>Pedidos importados: <strong>{importResult.orderCount}</strong></p>
                {importResult.skipped && importResult.skipped > 0 && (
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Pedidos ignorados (já existentes): <strong>{importResult.skipped}</strong>
                  </p>
                )}
                {importResult.totalProcessed && (
                  <p className="text-xs text-muted-foreground">
                    Total processado: {importResult.totalProcessed} pedidos
                  </p>
                )}
                <p className="text-xs mt-2">Redirecionando para o histórico...</p>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800 dark:text-red-200">
                {errorMessage || 'Erro ao fazer upload do arquivo'}
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading || !file || !marketplace}
            className="w-full"
          >
            {isUploading ? 'Importando...' : 'Importar Arquivo'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato do Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
            O arquivo Excel será processado automaticamente. O sistema:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Detecta automaticamente o marketplace (Mercado Livre, Shopee, Shein, TikTok)</li>
            <li>Evita duplicação de pedidos já importados</li>
            <li>Ignora pedidos com a mesma data e ID</li>
            <li>Cria uma loja automaticamente se necessário</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
