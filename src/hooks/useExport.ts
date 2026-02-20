import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
// @ts-ignore
import TurndownService from 'turndown';

export function useExport(editor: Editor | null, title: string) {
    const exportPDF = useCallback(() => {
        if (!editor) return;
        const element = document.createElement('div');
        element.innerHTML = editor.getHTML();
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
    }, [editor, title]);

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

    const exportMarkdown = useCallback(() => {
        if (!editor) return;
        const turndownService = new TurndownService();
        // @ts-ignore
        const markdown = turndownService.turndown(editor.getHTML());
        downloadFile(`${title}.md`, markdown, 'text/markdown');
    }, [editor, title]);

    const exportHTML = useCallback(() => {
        if (!editor) return;
        downloadFile(`${title}.html`, editor.getHTML(), 'text/html');
    }, [editor, title]);

    return { exportPDF, exportMarkdown, exportHTML };
}
