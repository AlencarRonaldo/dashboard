import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 py-16 px-8 text-center">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Dashboard Analítico
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Análise completa de vendas dos marketplaces. Visualize métricas, acompanhe o desempenho e tome decisões baseadas em dados.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Acessar Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/import">
              Importar Dados
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">
              Análise em Tempo Real
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe suas vendas e métricas em tempo real com atualizações instantâneas.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">
              Múltiplos Marketplaces
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Integre dados de diferentes plataformas em um único painel de controle.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">
              Relatórios Detalhados
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Gere relatórios completos e insights para otimizar suas vendas.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
