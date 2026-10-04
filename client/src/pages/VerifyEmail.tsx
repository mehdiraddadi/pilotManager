import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Cible du lien envoyé par email : valide le jeton, ouvre la session puis redirige vers le dashboard.
export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Évite un second appel (StrictMode) qui échouerait puisque le jeton est consommé au premier.
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError('Lien de confirmation invalide');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(({ data }) => {
        startSession(data.token, data.user);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(
          (axios.isAxiosError(err) && err.response?.data?.error) || 'Impossible de confirmer votre email'
        );
      });
  }, [searchParams, startSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <Link to="/login" className="text-sm font-medium text-teal-700 hover:underline">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <p className="text-sm text-slate-500">Confirmation de votre email...</p>
        )}
      </div>
    </div>
  );
}
