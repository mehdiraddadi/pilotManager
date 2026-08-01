import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Bonjour {user?.firstName} 👋
      </h1>
      <p className="mt-1 text-slate-500">
        Voici un aperçu de votre activité. Cette page sera enrichie avec les KPIs
        (CA, taux d'occupation, CRA en attente...) au fur et à mesure du développement.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { label: 'Clients actifs', value: '—' },
          { label: 'Projets en cours', value: '—' },
          { label: 'Consultants staffés', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
