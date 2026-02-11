export function IntroCard() {
  return (
    <div 
      className="p-6 rounded-[14px] shadow-lg"
      style={{ 
        background: '#232421',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div 
        className="inline-block px-3 py-1 rounded-full mb-4"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          color: '#9ca3af',
          fontSize: '0.875rem'
        }}
      >
        Platzhalter
      </div>
      
      <h1 className="mb-3" style={{ color: '#e5e7eb' }}>
        Kurze Beschreibung des Dashboards
      </h1>
      
      <p style={{ color: '#9ca3af' }}>
        Dieses Dashboard bietet einen umfassenden Überblick über den Zustand Ihrer Maschinen 
        und ermöglicht präzise Vorhersagen für vorausschauende Wartung. Analysieren Sie 
        Maschinendaten in Echtzeit und identifizieren Sie potenzielle Probleme, bevor sie auftreten.
      </p>
    </div>
  );
}
