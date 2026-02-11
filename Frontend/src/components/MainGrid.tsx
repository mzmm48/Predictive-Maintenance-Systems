export function MainGrid() {
  const alarmData = [
    { time: '—:—', facility: '—', type: '—', severity: '—' },
    { time: '—:—', facility: '—', type: '—', severity: '—' },
    { time: '—:—', facility: '—', type: '—', severity: '—' }
  ];
  
  return (
    <div className="grid grid-cols-[1.3fr_0.7fr] gap-4">
      {/* Chart Card */}
      <div 
        className="p-6 rounded-[14px] shadow-lg"
        style={{ 
          background: '#232421',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 className="mb-4" style={{ color: '#e5e7eb' }}>
          Diagramm-Platzhalter
        </h2>
        
        <div 
          className="h-64 rounded-lg flex items-center justify-center relative overflow-hidden"
          style={{ background: 'rgba(107, 103, 92, 0.2)' }}
        >
          {/* Diagonal stripes pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(229, 231, 235, 0.3) 10px, rgba(229, 231, 235, 0.3) 20px)'
            }}
          ></div>
          <span style={{ color: '#9ca3af', zIndex: 1 }}>
            Chart hier hinzufügen?
          </span>
        </div>
      </div>
      
      {/* Alarms Card */}
      <div 
        className="p-6 rounded-[14px] shadow-lg"
        style={{ 
          background: '#232421',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 className="mb-4" style={{ color: '#e5e7eb' }}>
          Letzte Alarme (Platzhalter)
        </h2>
        
        <div 
          className="rounded-lg overflow-hidden"
          style={{ background: '#6b675c' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th className="px-3 py-2 text-left" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Zeit</th>
                <th className="px-3 py-2 text-left" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Anlage</th>
                <th className="px-3 py-2 text-left" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Typ</th>
                <th className="px-3 py-2 text-left" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Schwere</th>
              </tr>
            </thead>
            <tbody>
              {alarmData.map((alarm, index) => (
                <tr 
                  key={index}
                  style={{ borderBottom: index < alarmData.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none' }}
                >
                  <td className="px-3 py-2" style={{ color: '#e5e7eb', fontSize: '0.875rem' }}>{alarm.time}</td>
                  <td className="px-3 py-2" style={{ color: '#e5e7eb', fontSize: '0.875rem' }}>{alarm.facility}</td>
                  <td className="px-3 py-2" style={{ color: '#e5e7eb', fontSize: '0.875rem' }}>{alarm.type}</td>
                  <td className="px-3 py-2" style={{ color: '#e5e7eb', fontSize: '0.875rem' }}>{alarm.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
