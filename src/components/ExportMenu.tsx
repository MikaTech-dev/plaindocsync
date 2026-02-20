import { Download } from 'lucide-react';
import type { Editor } from '@tiptap/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
// @ts-ignore
import TurndownService from 'turndown';

export function ExportMenu({ editor, title }: { editor: Editor; title: string }) {
    const exportPDF = () => {
        const element = document.createElement('div');
        element.innerHTML = editor.getHTML();
        // Add some basic styling for the PDF
        element.style.padding = '20px';
        element.style.fontFamily = 'Arial, sans-serif';

        const opt = {
            margin: 1,
            filename: `${title}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
        };

        html2pdf().set(opt).from(element).save();
    };

    const exportMarkdown = () => {
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(editor.getHTML());
        downloadFile(`${title}.md`, markdown, 'text/markdown');
    };

    const exportHTML = () => {
        downloadFile(`${title}.html`, editor.getHTML(), 'text/html');
    };

    const downloadFile = (filename: string, content: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const [isOpen, setIsOpen] = useState(false);
    // Simple dropdown implementation (or use a library)
    // Since we don't have a UI library, we'll make a custom one.

    return (
        <div className="relative inline-block text-left">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                title="Export"
            >
                <Download size={18} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-md shadow-lg border border-gray-100 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="py-1">
                        <button onClick={() => { exportPDF(); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            PDF
                        </button>
                        <button onClick={() => { exportMarkdown(); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            Markdown
                        </button>
                        <button onClick={() => { exportHTML(); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            HTML
                        </button>
                    </div>
                </div>
            )}

            {/* Click outside listener could be added here for better UX, but skip for now */}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
}

import { useState } from 'react';
