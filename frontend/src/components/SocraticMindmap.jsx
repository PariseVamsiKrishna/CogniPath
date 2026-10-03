import React, { useEffect, useRef, useState } from 'react';
import { Download, X, Loader2, BrainCircuit } from 'lucide-react';
import { socraticAPI } from '../services/api';

// NOTE: mermaid and jsPDF are loaded dynamically (lazy) to keep the main bundle small.
// They are only fetched when the user actually opens the mindmap modal.

export default function SocraticMindmap({ topic, onClose }) {
  const [loading, setLoading] = useState(true);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      try {
        setLoading(true);
        setError('');

        // Lazy-load mermaid so the main bundle stays small
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

        const data = await socraticAPI.getMindmap(topic);

        if (cancelled) return;

        if (data && data.mermaid_code) {
          const id = 'cgp-mindmap-' + Date.now();
          const { svg } = await mermaid.render(id, data.mermaid_code);
          if (!cancelled) setSvgContent(svg);
        } else {
          setError('No mindmap data returned from server.');
        }
      } catch (err) {
        if (!cancelled) setError('Failed to generate mindmap. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMap();
    return () => { cancelled = true; };
  }, [topic]);

  const handleExportPDF = async () => {
    if (!containerRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        backgroundColor: '#0A0D1C',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Mindmap_${topic.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0D1C]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12162B] border border-[#262C4C] rounded-2xl max-w-5xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#262C4C] bg-[#0A0D1C]/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#ECEDF7] truncate">{topic}</h2>
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">AI Socratic Knowledge Graph</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            {!loading && !error && svgContent && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            )}
            <button onClick={onClose} className="p-2.5 text-[#8A90B4] hover:text-white rounded-xl hover:bg-[#262C4C] transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center min-h-[400px]">
          {loading && (
            <div className="flex flex-col items-center gap-4 text-[#8A90B4]">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Synthesizing knowledge graph for <span className="text-purple-300">{topic}</span>...</p>
              <p className="text-xs text-[#8A90B4]/60">Loading AI renderer...</p>
            </div>
          )}

          {error && (
            <div className="text-rose-400 bg-rose-500/10 border border-rose-500/30 p-5 rounded-xl text-sm font-bold flex items-center gap-2 max-w-md text-center">
              <X className="h-5 w-5 shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && svgContent && (
            <div
              ref={containerRef}
              className="w-full flex justify-center items-start overflow-auto bg-[#0A0D1C] rounded-xl p-4 border border-[#262C4C]"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
