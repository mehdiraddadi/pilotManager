import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Company } from '../types';

// Bloque l'accès au reste de l'application tant que la société (l'ESN elle-même) n'a pas été
// configurée : c'est la toute première étape à faire avant de créer un client, un projet, etc.
export function CompanyGate({ children }: { children: ReactNode }) {
  const location = useLocation();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company | null>('/company')).data,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Chargement...
      </div>
    );
  }

  if (!company && location.pathname !== '/company') {
    return <Navigate to="/company" replace />;
  }

  return <>{children}</>;
}
