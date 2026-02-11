export function BottomGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Data Card */}
      <div 
        className="p-6 rounded-[14px] shadow-lg"
        style={{ 
          background: '#232421',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 className="mb-4" style={{ color: '#e5e7eb' }}>
          Daten
        </h2>
        
        <div className="space-y-4">
          {/* File Field */}
          <div>
            <label className="block mb-2" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Datei
            </label>
            <div 
              className="p-4 rounded-lg flex items-center justify-center"
              style={{ 
                background: 'rgba(107, 103, 92, 0.3)',
                border: '2px dashed rgba(156, 163, 175, 0.3)'
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                [ Upload-Feld – später einbauen ]
              </span>
            </div>
          </div>
          
          {/* Dataset Info Field */}
          <div>
            <label className="block mb-2" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Datensatz-Info
            </label>
            <div 
              className="p-4 rounded-lg"
              style={{ 
                background: 'rgba(107, 103, 92, 0.3)',
                border: '1px solid rgba(156, 163, 175, 0.2)'
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                [ Beschreibung / Vorschau ]
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Model Card */}
      <div 
        className="p-6 rounded-[14px] shadow-lg"
        style={{ 
          background: '#232421',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 className="mb-4" style={{ color: '#e5e7eb' }}>
          Modell
        </h2>
        
        <div className="space-y-4">
          {/* Algorithm Field */}
          <div>
            <label className="block mb-2" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Algorithmus
            </label>
            <div 
              className="p-3 rounded-lg"
              style={{ 
                background: 'rgba(107, 103, 92, 0.3)',
                border: '1px solid rgba(156, 163, 175, 0.2)'
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                [ Dropdown: Entscheidungsbaum / NFD / K-Means ]
              </span>
            </div>
          </div>
          
          {/* Parameters Field */}
          <div>
            <label className="block mb-2" style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Parameter
            </label>
            <div 
              className="p-3 rounded-lg"
              style={{ 
                background: 'rgba(107, 103, 92, 0.3)',
                border: '1px solid rgba(156, 163, 175, 0.2)'
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                [ z.B. max_depth, k, … ]
              </span>
            </div>
          </div>
          
          {/* Confusion Matrix Placeholder */}
          <div>
            <div 
              className="h-32 rounded-lg flex items-center justify-center relative overflow-hidden"
              style={{ background: 'rgba(107, 103, 92, 0.2)' }}
            >
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(229, 231, 235, 0.3) 10px, rgba(229, 231, 235, 0.3) 20px)'
                }}
              ></div>
              <span style={{ color: '#9ca3af', fontSize: '0.875rem', zIndex: 1 }}>
                Konfusionsmatrix (Platzhalter)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
