export function KPIGrid() {
  const kpis = [
    { title: 'Gesundheit', value: '—%', description: 'Durchschnittlicher Zustand' },
    { title: 'Aktive Alarme', value: '—', description: 'Erfordert Aufmerksamkeit' },
    { title: 'Vorhersagen (7d)', value: '—', description: 'Kommende Ereignisse' },
    { title: 'Auswertungsdauer', value: '—', description: 'Durchschn. Analysezeit' }
  ];
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className="p-5 rounded-[14px] shadow-lg"
          style={{ 
            background: '#232421',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="mb-2" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {kpi.title}
          </div>
          <div className="mb-2" style={{ 
            color: '#e5e7eb',
            fontSize: '1.875rem',
            fontWeight: '600'
          }}>
            {kpi.value}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {kpi.description}
          </div>
        </div>
      ))}
    </div>
  );
}
