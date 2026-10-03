import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, X, Loader2, BrainCircuit } from 'lucide-react';
import { socraticAPI } from '../services/api';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

export default function SocraticMindmap({ topic, onClose }) {
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    async function loadMap() {
      try {
        setLoading(true);
        const data = await socraticAPI.getMindmap(topic);
        setMapData(data);
        
        // Render mermaid
        if (data.mermaid_code) {
          const { svg } = await mermaid.render('mermaid-svg-container-' + Date.now(), data.mermaid_code);
          setSvgContent(svg);
        }
      } catch (err) {
        setError('Failed to generate mindmap. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadMap();
  }, [topic]);

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    try {
      // Create a wrapper div specifically for export to ensure layout is correct
      const exportContainer = document.createElement('div');
      exportContainer.style.backgroundColor = '#0A0D1C';
      exportContainer.style.padding = '40px';
      exportContainer.style.width = '1920px';
      exportContainer.style.display = 'flex';
      exportContainer.style.flexDirection = 'column';
      exportContainer.style.alignItems = 'center';
      
      // Add Title
      const titleEl = document.createElement('h1');
      titleEl.style.color = '#ECEDF7';
      titleEl.style.fontFamily = 'sans-serif';
      titleEl.style.marginBottom = '20px';
      titleEl.innerText = `${topic} - COGNIPATH AI Mindmap`;
      exportContainer.appendChild(titleEl);

      // Add SVG
      const svgClone = containerRef.current.cloneNode(true);
      exportContainer.appendChild(svgClone);
      document.body.appendChild(exportContainer);

      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        backgroundColor: '#0A0D1C',
        logging: false
      });
      
      document.body.removeChild(exportContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Mindmap_${topic.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0D1C]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12162B] border border-[#262C4C] rounded-2xl max-w-5xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#262C4C] bg-[#0A0D1C]/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#ECEDF7] truncate">{topic}</h2>
              <span className="text-[11px] text-purple-400 font-bold uppercase tracking-widest">AI Generated Socratic Knowledge Graph</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!loading && !error && (
              <button 
                onClick={handleExportPDF}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-[#8B7CFF] hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-500/50 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <Download className="h-4 w-4" /> Export High-Res PDF
              </button>
            )}
            <button onClick={onClose} className="p-2.5 text-[#8A90B4] hover:text-white rounded-xl hover:bg-[#262C4C] transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center min-h-[500px]">
          {loading && (
            <div className="flex flex-col items-center gap-5 text-[#8A90B4]">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Synthesizing neural knowledge graph for {topic}...</p>
            </div>
          )}

          {error && (
            <div className="text-rose-400 bg-rose-500/10 border border-rose-500/30 p-5 rounded-xl text-sm font-bold flex items-center gap-2">
              <X className="h-5 w-5" /> {error}
            </div>
          )}

          {!loading && !error && svgContent && (
            <div 
              ref={containerRef}
              className="w-full flex justify-center items-center overflow-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
