// Copies the originals in assets/ into public/ so the resume is served at /resume.pdf.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });
copyFileSync('assets/resume.pdf', 'public/resume.pdf');
